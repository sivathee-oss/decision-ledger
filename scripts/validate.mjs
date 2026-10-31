import { readFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const html=readFileSync('index.html','utf8');
for (const term of ['function vPlans()', 'Decision Ledger','/billing.js','/billing.css','/ai-chat.js','/ai-chat.css','function vRev()','function wsSwitch(']) {
  if (!html.includes(term)) throw Error('Missing expected app feature: '+term);
}
// Only ship public frontend files. Publishing the project root could expose
// migrations, sources, configuration templates or accidentally committed secrets.
const out='dist';
rmSync(out, {recursive:true,force:true});
mkdirSync(out, {recursive:true});
for (const file of ['index.html','billing.js','billing.css','ai-chat.js','ai-chat.css']) {
  copyFileSync(file, join(out,file));
}
console.log('Validated existing modules; built dist/ with 5 public assets only.');
