import {json,onlyMethod,errorResponse,bodyJSON,requireUser,supabaseAdmin,ownedWorkspace,priceFor,stripeClient,stripeCustomer,siteOrigin,fail,randomIdentifier} from './lib/core.mjs';
export default async (request)=>{try{
  onlyMethod(request,'POST');const db=supabaseAdmin(),user=await requireUser(request,db),body=await bodyJSON(request);
  const workspace=await ownedWorkspace(db,user,body.workspace_id);
  if(['active','trialing','past_due','unpaid'].includes(workspace.subscription_status))fail('This workspace already has a subscription. Open Manage Billing instead.',409);
  const price=priceFor(body.plan,body.interval||'month'),stripe=stripeClient();
  const customer=await stripeCustomer(db,stripe,workspace,user);
  // Prevent a second Checkout while a billable (or incomplete) subscription exists in Stripe.
  const existing=await stripe.subscriptions.list({customer,status:'all',limit:30});
  if(existing.data.some(s=>['active','trialing','past_due','unpaid','incomplete','paused'].includes(s.status)))fail('A Stripe subscription already exists for this workspace. Use the Customer Portal.',409);
  const origin=siteOrigin();
  const requestId=body.request_id;
  if(!requestId || !/^[a-f0-9-]{36}$/i.test(requestId))fail('Invalid request identifier');
  const session=await stripe.checkout.sessions.create({
    mode:'subscription',customer,client_reference_id:workspace.id,
    line_items:[{price,quantity:1}],
    success_url:`${origin}/?billing=success#pricing`,cancel_url:`${origin}/?billing=cancel#pricing`,
    metadata:{workspace_id:workspace.id,plan:body.plan},
    subscription_data:{metadata:{workspace_id:workspace.id}},
    integration_identifier:randomIdentifier(),
    allow_promotion_codes:true
  },{idempotencyKey:`dl:checkout:${requestId}`});
  if(!session.url)fail('Stripe did not return a Checkout URL',502);
  return json({url:session.url});
}catch(e){return errorResponse(e)}};
