import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const isUUID = (value) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const json = (data, status=200) => new Response(JSON.stringify(data), { status, headers: { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', 'x-content-type-options':'nosniff' } });
export const errorResponse = (error) => {
  const status = Number.isInteger(error?.status) && error.status>=400 && error.status<500 ? error.status : 500;
  if(status===500) console.error('Billing server error', error);
  return json({error: status===500 ? 'Billing service unavailable. Please try again later.' : error.message},status);
};
export function fail(message,status=400){const err=new Error(message);err.status=status;throw err}
export function onlyMethod(request,method){if(request.method!==method)fail('Method not allowed',405)}
export async function bodyJSON(request){let value;try{value=await request.json()}catch{fail('Invalid JSON body')};if(!value || typeof value!=='object' || Array.isArray(value))fail('Expected JSON object');return value}
export function requireEnv(name){const value=process.env[name];if(!value)fail(`Missing server configuration: ${name}`,503);return value}
export function siteOrigin(){const url=new URL(requireEnv('SITE_URL'));if(url.protocol!=='https:' && url.hostname!=='localhost')fail('SITE_URL must use HTTPS',503);return url.origin}
export function stripeClient(){
  const key=requireEnv('STRIPE_API_KEY');
  if(process.env.STRIPE_TEST_MODE==='false'){ if(!/^(sk|rk)_live_/.test(key))fail('Live mode requires a live-mode restricted key',503); }else if(!/^(sk|rk)_test_/.test(key))fail('Sandbox-only mode: provide a test API key',503);
  return new Stripe(key,{apiVersion:'2026-09-30.endive',appInfo:{name:'Decision Ledger',version:'1.0.0'}});
}
export function supabaseAdmin(){return createClient(requireEnv('SUPABASE_URL'),requireEnv('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}})}
export async function requireUser(request,db=supabaseAdmin()){
  const header=request.headers.get('authorization')||'';
  const token=/^Bearer (\S+)$/i.exec(header)?.[1];
  if(!token)fail('Sign in to continue',401);
  const {data,error}=await db.auth.getUser(token);
  if(error||!data?.user||!data.user.email_confirmed_at)fail('Your authenticated session is invalid or unverified',401);
  return data.user;
}
export async function ownedWorkspace(db,user,id){
  if(!isUUID(id))fail('Invalid workspace ID');
  const {data,error}=await db.from('billing_workspaces').select('*').eq('id',id).eq('owner_id',user.id).maybeSingle();
  if(error)throw error;
  if(!data)fail('Workspace not linked to this account',403);
  return data;
}
export function priceFor(plan,interval){
  if(!['Pro','Elite'].includes(plan)||!['month','year'].includes(interval))fail('Invalid subscription plan');
  const price=process.env[`STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`];
  if(!price || !/^price_[A-Za-z0-9]+$/.test(price))fail(`${plan} ${interval} price is not configured`,503);
  return price;
}
export function planForPrice(priceId){
  for(const plan of ['Pro','Elite'])for(const interval of ['MONTH','YEAR'])if(priceId && process.env[`STRIPE_PRICE_${plan.toUpperCase()}_${interval}`]===priceId)return plan;
  return null;
}
export function hasPaidAccess(status){return status==='active'||status==='trialing'}
export function canUsePremium(workspace){return !!workspace && hasPaidAccess(workspace.subscription_status) && workspace.payment_risk_hold!==true && ['Pro','Elite'].includes(workspace.plan)}
export function isAdmin(user){return !!user.email && (process.env.BILLING_ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).includes(user.email.toLowerCase())}
export function subscriptionPeriodEnd(sub){const unix=sub?.items?.data?.[0]?.current_period_end ?? sub?.current_period_end;return typeof unix==='number'?new Date(unix*1000).toISOString():null}
export function randomIdentifier(){const bytes=crypto.getRandomValues(new Uint8Array(8));return 'decision-ledger_'+Array.from(bytes,b=>String.fromCharCode(97+b%26)).join('')}
export async function updateCustomer(db,id,customerId){
  const {data,error}=await db.from('billing_workspaces').update({stripe_customer_id:customerId}).eq('id',id).is('stripe_customer_id',null).select('id').maybeSingle();
  if(error)throw error;
  if(!data){const {data:current,error:readError}=await db.from('billing_workspaces').select('stripe_customer_id').eq('id',id).single();if(readError)throw readError;if(current.stripe_customer_id!==customerId)fail('Customer binding conflict',409)}
}
export async function stripeCustomer(db,stripe,workspace,user){
  if(workspace.stripe_customer_id)return workspace.stripe_customer_id;
  const customer=await stripe.customers.create({email:user.email,name:workspace.display_name||undefined,metadata:{workspace_id:workspace.id}},{idempotencyKey:`dl:customer:${workspace.id}`});
  await updateCustomer(db,workspace.id,customer.id);
  return customer.id;
}
export async function applyStripeEvent(db,args){
  const {data,error}=await db.rpc('billing_apply_event',args);
  if(error)throw error;
  return data;
}
