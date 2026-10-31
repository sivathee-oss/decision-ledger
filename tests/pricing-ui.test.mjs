import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync('index.html','utf8');
const billing=readFileSync('billing.js','utf8');
test('prices are accurate and no uncreated annual billing is advertised',()=>{
 assert.match(html,/\[0,30,50\]/);
 assert.match(html,/USD \$30 \/ workspace \/ month/);
 assert.match(html,/USD \$50 \/ workspace \/ month/);
 assert.match(html,/no invented annual discount/);
});
test('paid plans have one primary checkout CTA each',()=>{
 assert.match(html,/data-billing-checkout="\$\{tier\}"/);
 assert.ok(!billing.includes('original}<button type="button" class="b dl-subscribe"'));
 assert.match(billing,/async function checkout\(plan\)/);
});
test('pricing accessible from application toolbar and landing',()=>{
 assert.match(html,/data-dl-price-shortcut/);
 assert.match(html,/dl-landing-price-strip/);
 assert.match(html,/Plans & Features/);
});
test('pricing honestly describes paid entitlement limitations',()=>{
 assert.match(html,/sandbox subscription does not enable cloud sync/);
 assert.match(html,/feature list below describes intended plan packaging/);
 assert.match(html,/No\. The current integration uses Stripe sandbox prices/);
});
test('unauthenticated checkout redirects users to the billing sign-in panel',()=>{
 assert.match(billing,/Sign in to test a subscription/);
 assert.match(billing,/dl-billing-panel/);
 assert.match(billing,/portal\(\)/);
});
