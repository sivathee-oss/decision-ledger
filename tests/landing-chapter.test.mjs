import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('the welcome experience has a dedicated penultimate subscription chapter',()=>{
 assert.match(html,/finalChapter\.insertAdjacentHTML\('beforebegin',landingPricingChapter\(\)\)/);
 assert.match(html,/if\(pricing\)out\.push\(\{y:pricing\.offsetTop,label:'Subscriptions & features'\}\)/);
 assert.match(html,/if\(tail\)out\.push\(\{y:tail\.offsetTop,label:'Get started'\}\)/);
});
test('the chapter includes all paid and free plan prices and real features',()=>{
 assert.match(html,/function landingPricingChapter\(\)/);
 for(const tier of ['Basic','Pro','Elite'])assert.match(html,new RegExp(`tier:'${tier}'`));
 for(const price of ["price:'0'","price:'30'","price:'50'"])assert.ok(html.includes(price));
 assert.match(html,/PLAN_HIGHLIGHTS\[p\.tier\]/);
 assert.match(html,/PLAN_CATALOG\.filter/);
 assert.match(html,/ps-compare-more/);
 assert.match(html,/sandbox mode/i);
});
test('paid CTA goes to a workspace/billing page and not directly to unverified checkout',()=>{
 assert.match(html,/data-landing-plan="Pro"/);
 assert.match(html,/data-landing-plan="Elite"/);
 assert.match(html,/if\(S\.org\)\{push\('pricing'\);apply\('pricing','list',null\);\}/);
 assert.match(html,/else A_\.enter\(\)/);
});
test('only hero/final get extra new workspace buttons, not subscription plan buttons',()=>{
 assert.match(html,/querySelectorAll\('\.gs\.hs \[data-a="enter"\], \.gs\.cs \[data-a="enter"\]'\)/);
});
