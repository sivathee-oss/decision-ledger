import {json,onlyMethod,errorResponse,bodyJSON,requireUser,supabaseAdmin,ownedWorkspace,isAdmin,stripeClient,fail} from './lib/core.mjs';
export default async (request)=>{try{
  onlyMethod(request,'POST');const db=supabaseAdmin(),user=await requireUser(request,db);
  if(!isAdmin(user))fail('Only authorized billing administrators may issue enterprise invoices',403);
  const body=await bodyJSON(request);
  if(body.confirm!==true)fail('Explicit invoice confirmation required');
  const workspace=await ownedWorkspace(db,user,body.workspace_id);
  if(!workspace.stripe_customer_id)fail('Workspace needs a Stripe Customer before invoicing',409);
  const amount=body.amount_cents,days=body.days_until_due,description=String(body.description||'').trim();
  if(!Number.isSafeInteger(amount)||amount<100||amount>100000000)fail('Amount must be between $1 and $1,000,000');
  if(!Number.isSafeInteger(days)||days<1||days>90)fail('Due days must be between 1 and 90');
  if(description.length<5||description.length>500)fail('Description must be 5–500 characters');
  if(!/^[a-f0-9-]{36}$/i.test(String(body.request_id||'')))fail('Invalid request identifier');
  const stripe=stripeClient(),key=`dl:invoice:${body.request_id}`;
  const invoice=await stripe.invoices.create({customer:workspace.stripe_customer_id,collection_method:'send_invoice',days_until_due:days,auto_advance:false,metadata:{workspace_id:workspace.id,kind:'enterprise'}},{idempotencyKey:key+':create'});
  await stripe.invoiceItems.create({customer:workspace.stripe_customer_id,invoice:invoice.id,amount,currency:'usd',description},{idempotencyKey:key+':item'});
  const final=await stripe.invoices.finalizeInvoice(invoice.id,{},{idempotencyKey:key+':finalize'});
  // Keep the invoice in Stripe's finalized state. The admin can review and send it in the Dashboard.
  return json({id:final.id,status:final.status,hosted_invoice_url:final.hosted_invoice_url,note:'Finalized in Stripe sandbox. Send from Stripe Dashboard after review.'});
}catch(e){return errorResponse(e)}};
