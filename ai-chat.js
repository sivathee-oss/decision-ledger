/* Optional authenticated OpenAI chat through Supabase Edge Functions. */
(function(){
  'use strict';
  if(typeof PG==='undefined'||!PG.ask)return;
  const original=PG.ask[1];
  const messages=[]; // Session-only. Never silently upload local decision records.
  let busy=false;
  const panel=()=>`<section class="card dl-ai-chat" id="dl-ai-chat" aria-label="AI chat assistant">
    <div class="dl-ai-head"><div><span class="dl-ai-eyebrow">OPTIONAL · CONNECTED AI</span><h3 style="font-size:20px;margin:5px 0 0">AI decision assistant</h3></div><span class="chip">Supabase · OpenAI</span></div>
    <p class="mut">Discuss a decision, compare options, or draft an evaluation framework. This is separate from the evidence-based keyword search above.</p>
    <div id="dl-ai-log" class="dl-ai-log" role="log" aria-live="polite" aria-relevant="additions text"><p class="mut">Ask a question to start a conversation.</p></div>
    <form id="dl-ai-form" class="dl-ai-input"><label for="dl-ai-prompt" class="sr-only">Your message to the AI assistant</label><textarea id="dl-ai-prompt" rows="2" maxlength="4000" placeholder="What should I consider before making this decision?" required></textarea><button type="submit" class="b" id="dl-ai-send">Send</button></form>
    <div class="dl-ai-status" id="dl-ai-status" role="status" aria-live="polite"></div>
    <p class="dl-ai-note">Requires Supabase sign-in. <button type="button" class="lnk" data-p="pricing" style="text-decoration:underline;color:var(--ac)">Sign in under Plans &amp; Features</button>. Your local ledger is <strong>not</strong> sent to the model automatically. Messages you enter are sent to OpenAI through your server function; avoid sharing confidential information. AI responses are not verified ledger evidence.</p>
  </section>`;
  PG.ask[1]=function(){const html=original();queueMicrotask(drawMessages);return html+panel()};
  function status(text,isError=false){const el=document.getElementById('dl-ai-status');if(el){el.textContent=text;el.classList.toggle('error',isError)}}
  function drawMessages(){
    const log=document.getElementById('dl-ai-log');if(!log)return;
    log.replaceChildren();
    if(!messages.length){const p=document.createElement('p');p.className='mut';p.textContent='Ask a question to start a conversation.';log.append(p);return}
    for(const m of messages){
      const item=document.createElement('div');item.className='dl-ai-message '+m.role;
      const heading=document.createElement('strong');heading.textContent=m.role==='user'?'You':'AI assistant';
      const content=document.createElement('span');content.textContent=m.content;
      item.append(heading,content);log.append(item);
    }
    log.scrollTop=log.scrollHeight;
  }
  async function send(prompt){
    if(busy)return;
    const provider=window.DecisionLedgerSupabase;
    const client=provider?.getClient?.();
    if(!client)throw Error('Supabase is not configured yet. Connect Supabase and set your Netlify environment variables.');
    const {data:{user},error:authError}=await client.auth.getUser();
    if(authError||!user)throw Error('Please sign in under Plans & Features before using AI chat.');
    busy=true;
    const button=document.getElementById('dl-ai-send');if(button)button.disabled=true;
    const history=messages.slice(-8).map(m=>({role:m.role,content:m.content.slice(0,1500)}));
    messages.push({role:'user',content:prompt});drawMessages();status('Thinking…');
    try{
      const {data,error}=await client.functions.invoke('chatgpt',{body:{prompt,history}});
      if(error){
        let detail='AI request failed. Check your Supabase function deployment and login.';
        try{const payload=await error.context?.json();if(payload?.error)detail=payload.error}catch(_e){}
        throw Error(detail);
      }
      if(typeof data?.answer!=='string'||!data.answer.trim())throw Error('AI returned no answer.');
      messages.push({role:'assistant',content:data.answer});drawMessages();status('Response received.');
    }catch(err){status(err?.message||'AI request failed.',true)}
    finally{busy=false;if(button)button.disabled=false}
  }
  document.addEventListener('submit',function(event){
    if(event.target?.id!=='dl-ai-form')return;
    event.preventDefault();event.stopPropagation();
    const input=document.getElementById('dl-ai-prompt');const prompt=input?.value.trim()||'';
    if(!prompt||prompt.length>4000||busy)return;
    input.value='';send(prompt).catch(e=>status(e.message,true));
  },true);
  document.addEventListener('keydown',function(event){
    if(event.target?.id==='dl-ai-prompt'&&event.key==='Enter'&&!event.shiftKey){
      event.preventDefault();document.getElementById('dl-ai-form')?.requestSubmit();
    }
  },true);
})();
