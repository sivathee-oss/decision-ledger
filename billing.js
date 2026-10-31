/* Decision Ledger Stripe billing UI. Billing is optional; the existing local app still works offline. */
(function(){
  'use strict';
  if(typeof PG==='undefined'||!PG.pricing)return;
  const oldPlans=PG.pricing[1];
  const state={config:null,client:null,user:null,working:false,workspaceId:null,details:null};
  // Share the authenticated client with optional AI chat without exposing secrets.
  window.DecisionLedgerSupabase={getClient:()=>state.client,getUser:()=>state.user};
  const escapeHTML=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function panel(){return `<section class="card dl-billing-panel" id="dl-billing-panel" aria-label="Stripe billing">
    <div class="row" style="justify-content:space-between;align-items:center"><div><span class="revenue-eyebrow">SECURE WORKSPACE BILLING</span><h3 style="font-size:20px;margin-top:8px">Manage your subscription</h3></div><span class="chip" id="dl-billing-environment">Sandbox</span></div>
    <p class="mut">Payments use Stripe-hosted pages. Sign in to associate billing with the active workspace. Decision records remain stored in this browser; purchasing does not activate cloud collaboration.</p>
    <div class="dl-billing-auth" id="dl-billing-auth"><label for="dl-billing-email">Your email address</label><div class="row" style="margin-top:8px"><input type="email" id="dl-billing-email" placeholder="you@company.com" autocomplete="email" style="flex:1;min-width:190px"><button type="button" class="b" data-billing-action="signin">Email sign-in link</button></div></div>
    <div id="dl-billing-account" hidden><p id="dl-billing-identity" class="mut"></p><div class="row"><button type="button" class="b s" data-billing-action="portal">Manage billing &amp; invoices</button><button type="button" class="b s" data-billing-action="refresh">Refresh status</button><button type="button" class="b s" data-billing-action="signout">Sign out</button></div><div id="dl-billing-status" class="dl-billing-status" aria-live="polite"></div></div>
    <div id="dl-billing-admin" hidden><h3 style="margin:14px 0 8px">Enterprise invoicing · administrator</h3><p class="mut">Creates a finalized invoice in Stripe for this workspace. Review and send it from the Stripe Dashboard.</p><div class="dl-billing-admin-grid"><label>Amount (USD)<input id="dl-invoice-amount" type="number" min="1" max="1000000" step="0.01" placeholder="500.00"></label><label>Due in days<input id="dl-invoice-days" type="number" min="1" max="90" value="30"></label><label class="wide">Description<input id="dl-invoice-description" type="text" maxlength="500" placeholder="Enterprise annual license"></label></div><button type="button" class="b s" data-billing-action="invoice">Create invoice (review before sending)</button></div>
    <p class="mut" id="dl-billing-message" role="status" aria-live="polite">Loading billing configuration…</p>
  </section>`}
  PG.pricing[1]=function(){
    let html=oldPlans();
    html=html.replace('<div class="plan-note">',panel()+'<div class="plan-note">');
    queueMicrotask(()=>{if(document.getElementById('dl-billing-panel')){render();if(state.user)refreshStatus().catch(showError)}});
    return html;
  };
  function message(text,kind=''){const el=document.getElementById('dl-billing-message');if(el){el.textContent=text;el.dataset.kind=kind}}
  function showError(err){console.warn('Billing:',err);message(err?.message||'Billing action failed.','error')}
  function activeId(){return typeof MW!=='undefined'?MW.active:null}
  function render(){
    const panel=document.getElementById('dl-billing-panel');if(!panel)return;
    const cfg=state.config;
    document.getElementById('dl-billing-environment').textContent=cfg?.testMode===false?'Live mode':'Sandbox / test mode';
    const mode=document.getElementById('dl-pricing-mode-label'),detail=document.getElementById('dl-pricing-mode-detail');
    if(mode&&detail){
      mode.textContent=cfg?.testMode===false?'Live subscription billing':'Stripe sandbox · no real payments';
      detail.textContent=cfg?.testMode===false?'USD billed monthly per workspace. Your billing status is verified by secure Stripe webhooks. Cloud collaboration and server-side product gating are not active yet.':'Stripe Checkout is in test mode. No real charges are made, and local workspace tools remain available for free exploration.';
    }
    document.querySelectorAll('[data-plan-cta]').forEach(b=>{
      const plan=b.dataset.planCta;
      const subscribed=state.details&&['active','trialing','past_due','unpaid','paused','incomplete'].includes(state.details.subscription_status);
      b.textContent=subscribed?'Manage subscription':cfg?.testMode===false?'Choose '+plan:'Test '+plan+' checkout';
      b.setAttribute('aria-label',subscribed?'Manage current workspace subscription in Stripe Customer Portal':(cfg?.testMode===false?'Subscribe to ':'Test ')+plan+' for '+(plan==='Pro'?'$30':'$50')+' per workspace per month');
    });
    document.getElementById('dl-billing-auth').hidden=!!state.user;
    document.getElementById('dl-billing-account').hidden=!state.user;
    if(state.user)document.getElementById('dl-billing-identity').textContent='Signed in as '+state.user.email+' · Workspace: '+(typeof o==='function'?o().name||'Unnamed':'Unnamed');
    const admin=document.getElementById('dl-billing-admin');admin.hidden=!state.details?.is_admin;
    const box=document.getElementById('dl-billing-status');
    if(box && state.user){const s=state.details;box.innerHTML=s?`<div class="row" style="gap:8px;margin:12px 0"><span class="chip">${escapeHTML(s.plan||'Basic')}</span><span class="chip">${escapeHTML(s.subscription_status||'none')}</span>${s.cancel_at_period_end?'<span class="chip">Cancels at period end</span>':''}${s.payment_risk_hold?'<span class="chip c-risk">Payment under review</span>':''}</div><p class="mut">${s.period_end?'Current period ends '+escapeHTML(new Date(s.period_end).toLocaleDateString()):'No active subscription period'}</p>${s.invoices?.length?`<h3>Recent invoices</h3><div class="dl-billing-invoices">${s.invoices.map(i=>`<div class="dl-billing-invoice"><span>${escapeHTML(i.status||'pending')} · ${escapeHTML(i.currency||'usd').toUpperCase()} ${((i.amount_due||0)/100).toFixed(2)}</span>${i.hosted_invoice_url?`<a href="${escapeHTML(i.hosted_invoice_url)}" target="_blank" rel="noopener noreferrer">View invoice ↗</a>`:''}</div>`).join('')}</div>`:''}`:'<p class="mut">Subscription details will appear here after sign-in.</p>'}
    if(!cfg?.configured){message('Backend not configured yet. Add Stripe and Supabase environment variables to Netlify. Your existing workspace remains usable.');}
    else if(!state.user){message('Sign in using a verified email to start a sandbox subscription.');}
  }
  async function api(path,method='GET',data){
    const session=await state.client?.auth.getSession();const token=session?.data?.session?.access_token;
    if(!token)throw Error('Please sign in before managing billing.');
    const r=await fetch('/api/billing/'+path,{method,headers:{'authorization':'Bearer '+token,...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined,cache:'no-store'});
    const payload=await r.json().catch(()=>({}));if(!r.ok)throw Error(payload.error||'Billing service returned '+r.status);return payload;
  }
  async function ensureWorkspace(){
    const id=activeId();if(!id)throw Error('Create or open a workspace before billing.');
    if(state.workspaceId===id)return id;
    await api('workspace','POST',{workspace_id:id,name:(typeof o==='function'&&o()?.name)||'Decision Ledger workspace'});
    state.workspaceId=id;state.details=null;return id;
  }
  async function refreshStatus(){if(!state.user)return;const id=await ensureWorkspace();state.details=await api('status?workspace_id='+encodeURIComponent(id));render();message('Billing status updated.');}
  async function signin(){
    if(!state.client)throw Error('Authentication is not configured yet.');
    const email=document.getElementById('dl-billing-email')?.value.trim();if(!email||!/^\S+@\S+\.\S+$/.test(email))throw Error('Enter a valid email address.');
    const redirect=location.origin+location.pathname+'?billing_auth=1#pricing';
    const {error}=await state.client.auth.signInWithOtp({email,options:{emailRedirectTo:redirect}});
    if(error)throw error;message('Sign-in link sent. Check your email and return to this browser.');
  }
  async function checkout(plan){
    if(!state.config?.configured){document.getElementById('dl-billing-panel')?.scrollIntoView({behavior:'smooth',block:'center'});throw Error('Checkout is not available until Stripe and Supabase are configured on Netlify.')}
    if(!state.user){message('Sign in to test a subscription. The sign-in form is just below the plan cards.');document.getElementById('dl-billing-panel')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});document.getElementById('dl-billing-email')?.focus({preventScroll:true});return}
    if(state.details && ['active','trialing','past_due','unpaid','paused','incomplete'].includes(state.details.subscription_status))return portal();
    if(!state.config.prices?.[plan]?.month)throw Error('Stripe price is not configured for '+plan);
    const id=await ensureWorkspace();
    const result=await api('checkout','POST',{workspace_id:id,plan,interval:'month',request_id:crypto.randomUUID()});
    if(!/^https:\/\//.test(result.url))throw Error('Invalid Checkout redirect');
    location.assign(result.url);
  }
  async function portal(){const id=await ensureWorkspace();const result=await api('portal','POST',{workspace_id:id});if(!/^https:\/\//.test(result.url))throw Error('Invalid Portal redirect');location.assign(result.url)}
  async function invoice(){
    if(!state.details?.is_admin)throw Error('Billing administrator permission required.');
    const amount=Math.round(Number(document.getElementById('dl-invoice-amount')?.value)*100),days=Number(document.getElementById('dl-invoice-days')?.value),description=document.getElementById('dl-invoice-description')?.value.trim();
    if(!Number.isSafeInteger(amount)||amount<100||!Number.isInteger(days)||days<1||days>90||!description||description.length<5)throw Error('Enter a valid amount, due date and description.');
    if(!confirm('Create a FINALIZED sandbox invoice for $'+(amount/100).toFixed(2)+'? It will not be sent automatically.'))return;
    const id=await ensureWorkspace(),result=await api('invoice','POST',{workspace_id:id,amount_cents:amount,days_until_due:days,description,request_id:crypto.randomUUID(),confirm:true});
    message('Invoice '+result.id+' created. Review and send it from Stripe Dashboard.');await refreshStatus();
  }
  document.addEventListener('click',async e=>{
    const button=e.target.closest('[data-billing-action],[data-billing-checkout]');if(!button)return;
    e.preventDefault();e.stopImmediatePropagation();if(state.working)return;
    state.working=true;button.disabled=true;
    try{
      if(button.dataset.billingCheckout)await checkout(button.dataset.billingCheckout);
      else switch(button.dataset.billingAction){
        case 'signin':await signin();break;
        case 'refresh':await refreshStatus();break;
        case 'portal':await portal();break;
        case 'invoice':await invoice();break;
        case 'signout':await state.client?.auth.signOut();state.user=null;state.workspaceId=null;state.details=null;render();break;
      }
    }catch(err){showError(err)}finally{state.working=false;button.disabled=false}
  },true);
  async function init(){
    try{
      const response=await fetch('/api/billing/config',{cache:'no-store'});
      if(!response.ok)throw Error('Netlify billing functions are not deployed yet.');
      state.config=await response.json();render();
      if(!state.config.configured)return;
      const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      state.client=createClient(state.config.supabaseUrl,state.config.supabaseAnonKey,{auth:{detectSessionInUrl:true,flowType:'pkce',persistSession:true}});
      state.client.auth.onAuthStateChange((_event,session)=>{state.user=session?.user||null;state.workspaceId=null;state.details=null;render();if(state.user && document.getElementById('dl-billing-panel'))setTimeout(()=>refreshStatus().catch(showError),0)});
      const {data,error}=await state.client.auth.getUser();if(!error && data?.user){state.user=data.user;render();if(document.getElementById('dl-billing-panel'))await refreshStatus()}
      if(new URLSearchParams(location.search).has('billing'))message('Checkout returned. Verifying subscription through Stripe webhooks; use Refresh status to confirm.');
    }catch(err){showError(err)}
  }
  init();
})();
