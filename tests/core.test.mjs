import test from 'node:test';import assert from 'node:assert/strict';
import {isUUID,priceFor,planForPrice,hasPaidAccess,subscriptionPeriodEnd,randomIdentifier} from '../netlify/functions/lib/core.mjs';
test('workspace ids require valid UUIDs',()=>{assert.equal(isUUID('11b5e0a0-c8b8-40ca-9dbb-8b94923ef301'),true);assert.equal(isUUID('ws-local-123'),false);assert.equal(isUUID(''),false)});
test('plans and intervals cannot be chosen arbitrarily',()=>{assert.throws(()=>priceFor('ElitePlus','month'),/Invalid/);assert.throws(()=>priceFor('Pro','week'),/Invalid/)});
test('configured Stripe Prices map to plans',()=>{process.env.STRIPE_PRICE_PRO_MONTH='price_proTest';process.env.STRIPE_PRICE_ELITE_MONTH='price_eliteTest';assert.equal(priceFor('Pro','month'),'price_proTest');assert.equal(planForPrice('price_eliteTest'),'Elite');assert.equal(planForPrice('price_unrecognized'),null)});
test('paid access only when active or trialing',()=>{for(const s of ['active','trialing'])assert.equal(hasPaidAccess(s),true);for(const s of ['none','past_due','unpaid','canceled','incomplete'])assert.equal(hasPaidAccess(s),false)});
test('billing period supports current subscription item',()=>{assert.equal(subscriptionPeriodEnd({items:{data:[{current_period_end:1800000000}]}}),new Date(1800000000*1000).toISOString());assert.equal(subscriptionPeriodEnd({}),null)});
test('Checkout integration identifier has valid shape',()=>{assert.match(randomIdentifier(),/^decision-ledger_[a-z]{8}$/)});
