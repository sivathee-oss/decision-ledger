import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
const html=readFileSync('index.html','utf8');
const ai=readFileSync('ai-chat.js','utf8');
const edge=readFileSync('supabase/functions/chatgpt/index.ts','utf8');
const sql=readFileSync('supabase/migrations/002_ai_quota.sql','utf8');
test('existing app loads billing and AI integration outside inline script',()=>{
  assert.match(html,/<script src="\/billing\.js"><\/script><script src="\/ai-chat\.js"><\/script>/);
  assert.match(html,/function vAsk\(\)/);
  assert.match(html,/function vRev\(\)/);
  assert.doesNotMatch(html,/defer><\/script><\/body><\/html>/);
});
test('AI chat is explicit, independent of keyword search, and renders model text safely',()=>{
  assert.match(ai,/PG\.ask\[1\]=function/);
  assert.match(ai,/client\.functions\.invoke\('chatgpt'/);
  assert.match(ai,/content\.textContent=m\.content/);
  assert.match(ai,/not<\/strong> sent to the model automatically/);
});
test('Edge Function requires auth, validates inputs, rate-limits, and hides OpenAI key',()=>{
  assert.match(edge,/auth\.auth\.getUser\(bearer\)/);
  assert.match(edge,/consume_ai_quota/);
  assert.match(edge,/prompt\.length > 4000/);
  assert.match(edge,/validHistory\(history\)/);
  assert.match(edge,/Bearer \$\{key\}/);
  assert.match(edge,/Origin not allowed/);
  assert.match(sql,/on conflict \(user_id, usage_day\) do update/);
  assert.match(sql,/to service_role/);
});
