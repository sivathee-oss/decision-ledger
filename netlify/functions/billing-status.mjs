import {json,onlyMethod,errorResponse,requireUser,supabaseAdmin,ownedWorkspace,isAdmin} from './lib/core.mjs';
export default async (request)=>{try{
  onlyMethod(request,'GET');const db=supabaseAdmin(),user=await requireUser(request,db);
  const id=new URL(request.url).searchParams.get('workspace_id');
  const w=await ownedWorkspace(db,user,id);
  const {data:invoices,error}=await db.from('billing_invoices').select('id,status,amount_due,currency,hosted_invoice_url,updated_at').eq('workspace_id',id).order('updated_at',{ascending:false}).limit(20);
  if(error)throw error;
  return json({workspace_id:id,plan:w.plan||'Basic',subscription_status:w.subscription_status||'none',period_end:w.period_end,cancel_at_period_end:w.cancel_at_period_end,has_customer:!!w.stripe_customer_id,invoices:invoices||[],payment_risk_hold:w.payment_risk_hold===true,is_admin:isAdmin(user)});
}catch(e){return errorResponse(e)}};
