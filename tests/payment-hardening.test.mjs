import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=x=>readFileSync(x,'utf8');
test('Stripe environment guard rejects live keys in sandbox',()=>{
 const c=file('netlify/functions/lib/core.mjs');
 assert.match(c,/STRIPE_TEST_MODE==='false'/);
 assert.match(c,/\(sk\|rk\)_live_/);
 assert.match(c,/\(sk\|rk\)_test_/);
});
test('checkout defends against multiple subscriptions and has explicit idempotency key',()=>{
 const c=file('netlify/functions/billing-checkout.mjs');
 assert.match(c,/stripe\.subscriptions\.list/);
 assert.match(c,/\['active','trialing','past_due','unpaid','incomplete','paused'\]/);
 assert.match(c,/idempotencyKey/);
 assert.doesNotMatch(c,/payment_method_types/);
});
test('risk-side webhook verifies the signature then records risk hold',()=>{
 const c=file('netlify/functions/stripe-webhook.mjs');
 for(const e of ['charge.dispute.created','charge.refunded','radar.early_fraud_warning.created'])assert.ok(c.includes(e));
 assert.match(c,/constructEvent/);
 assert.match(c,/billing_apply_risk/);
});
test('database risk recording requires a matched Stripe Customer and is service-role only',()=>{
 const c=file('supabase/migrations/003_payment_risk.sql');
 assert.match(c,/v_customer<>p_customer_id/);
 assert.match(c,/grant execute.*to service_role/i);
 assert.match(c,/payment_risk_hold=true/);
});
test('premium server endpoints block charge risk holds',()=>{
 const c=file('netlify/functions/lib/core.mjs');
 const e=file('netlify/functions/billing-entitlement-example.mjs');
 assert.match(c,/workspace\.payment_risk_hold!==true/);
 assert.match(e,/canUsePremium\(workspace\)/);
});
test('frontend uses a two-tone scalable original vector mark',()=>{
 const h=file('index.html');
 assert.match(h,/id="dlmetal"/);
 assert.match(h,/stroke="#65B5AE"/);
});
