import {json,onlyMethod,errorResponse,bodyJSON,requireUser,supabaseAdmin,ownedWorkspace,stripeClient,siteOrigin,fail} from './lib/core.mjs';
export default async (request)=>{try{
  onlyMethod(request,'POST');const db=supabaseAdmin(),user=await requireUser(request,db),body=await bodyJSON(request);
  const workspace=await ownedWorkspace(db,user,body.workspace_id);
  if(!workspace.stripe_customer_id)fail('No Stripe customer exists for this workspace yet',409);
  const session=await stripeClient().billingPortal.sessions.create({customer:workspace.stripe_customer_id,return_url:`${siteOrigin()}/#pricing`});
  return json({url:session.url});
}catch(e){return errorResponse(e)}};
