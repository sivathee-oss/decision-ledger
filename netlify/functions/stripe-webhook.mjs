import {json,errorResponse,onlyMethod,stripeClient,supabaseAdmin,requireEnv,applyStripeEvent,planForPrice,subscriptionPeriodEnd,fail,isUUID} from './lib/core.mjs';

function idOf(value){return typeof value==='string'?value:value?.id||null}
async function resolveWorkspace(db,customerId,hint){
  if(!customerId)fail('Missing Stripe Customer ID',422);
  const {data,error}=await db.from('billing_workspaces').select('id,stripe_customer_id').eq('stripe_customer_id',customerId).maybeSingle();
  if(error)throw error;
  if(data){if(hint && hint!==data.id)fail('Workspace mismatch',422);return data.id}
  if(hint && isUUID(hint)){
    const {data:pending,error:pendingError}=await db.from('billing_workspaces').select('id,stripe_customer_id').eq('id',hint).maybeSingle();
    if(pendingError)throw pendingError;
    if(pending && (!pending.stripe_customer_id || pending.stripe_customer_id===customerId))return pending.id;
  }
  fail('Stripe customer is not linked to a workspace',422);
}
function base(event,workspaceId,customerId){return {p_event_id:event.id,p_event_type:event.type,p_event_created:new Date(event.created*1000).toISOString(),p_workspace_id:workspaceId,p_customer_id:customerId}}
async function handleSubscription(db,event,sub,hint){
  const customer=idOf(sub.customer),workspaceId=await resolveWorkspace(db,customer,hint||sub.metadata?.workspace_id);
  const priceId=sub.items?.data?.[0]?.price?.id||null,plan=planForPrice(priceId);
  if(['active','trialing'].includes(sub.status)&&!plan)fail('Subscription uses an unrecognized Stripe Price',422);
  return applyStripeEvent(db,{...base(event,workspaceId,customer),p_subscription_id:sub.id,p_subscription_status:sub.status,p_plan:plan,p_price_id:priceId,p_period_end:subscriptionPeriodEnd(sub),p_cancel_at_period_end:!!sub.cancel_at_period_end});
}
async function handleInvoice(db,event,invoice){
  const customer=idOf(invoice.customer),hint=invoice.metadata?.workspace_id;
  const workspaceId=await resolveWorkspace(db,customer,hint);
  return applyStripeEvent(db,{...base(event,workspaceId,customer),p_invoice_id:invoice.id,p_invoice_status:invoice.status,p_invoice_amount:invoice.amount_due??null,p_invoice_currency:invoice.currency??null,p_invoice_url:invoice.hosted_invoice_url||null});
}
export default async (request)=>{try{
  onlyMethod(request,'POST');
  const signature=request.headers.get('stripe-signature');if(!signature)fail('Missing Stripe signature',400);
  const stripe=stripeClient();
  let event;try{event=stripe.webhooks.constructEvent(await request.text(),signature,requireEnv('STRIPE_WEBHOOK_SECRET'))}catch{fail('Invalid Stripe signature',400)}
  const db=supabaseAdmin(),obj=event.data.object;
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
    if(obj.mode!=='subscription'||!obj.subscription)return json({received:true,ignored:true});
    const sub=await stripe.subscriptions.retrieve(idOf(obj.subscription));
    await handleSubscription(db,event,sub,obj.metadata?.workspace_id||obj.client_reference_id);
  }else if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type)){
    await handleSubscription(db,event,obj);
  }else if(['invoice.paid','invoice.payment_failed','invoice.finalized','invoice.voided','invoice.marked_uncollectible'].includes(event.type)){
    await handleInvoice(db,event,obj);
  }else if(['charge.dispute.created','charge.refunded','radar.early_fraud_warning.created'].includes(event.type)){
    // Risk events freeze paid API entitlements until reviewed by an operator.
    const chargeId=event.type==='radar.early_fraud_warning.created'?idOf(obj.charge):event.type==='charge.dispute.created'?idOf(obj.charge):obj.id;
    if(!chargeId)fail('Missing risk charge reference',422);
    const charge=event.type==='charge.refunded'?obj:await stripe.charges.retrieve(chargeId);
    const customer=idOf(charge.customer);
    const workspaceId=await resolveWorkspace(db,customer,null);
    const {error}=await db.rpc('billing_apply_risk',{p_event_id:event.id,p_event_type:event.type,p_event_created:new Date(event.created*1000).toISOString(),p_workspace_id:workspaceId,p_customer_id:customer,p_charge_id:chargeId});
    if(error)throw error;
  }else return json({received:true,ignored:true});
  return json({received:true});
}catch(e){return errorResponse(e)}};
