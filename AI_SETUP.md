# Connect Decision Ledger to OpenAI through Supabase

**Built in source. Not yet deployed.** Requires a Supabase project and an OpenAI API key with API billing enabled.

## 1. Connect your project

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

## 2. Create the request quota

Run `supabase/migrations/002_ai_quota.sql` in your project's SQL Editor. It creates a service-role-only atomic per-user quota (default 25 requests per UTC day).

If the original billing integration has not been installed, first apply `supabase/migrations/001_billing.sql` and configure Netlify's Supabase authentication settings (see README.md).

## 3. Add the secret

In **Supabase Dashboard → Edge Function Secrets**, set:

- `OPENAI_API_KEY` = your private OpenAI API key (do not put this in the browser).
- `AI_ALLOWED_ORIGINS` = `https://decision-ledger-app.netlify.app` (add your exact custom domain if applicable).
- `AI_DAILY_REQUEST_LIMIT` = `25` (optional).
- `OPENAI_MODEL` = `gpt-4o-mini` (optional).

Supabase supplies its project URL and API keys to hosted functions. The function uses the service-role key only to call the quota RPC; the user must authenticate separately.

## 4. Deploy the Edge Function

```bash
supabase functions deploy chatgpt
```

Keep JWT verification enabled (`supabase/config.toml`).

## 5. Deploy the full app

Deploy the entire project (including `index.html`, `ai-chat.js`, `ai-chat.css`, `billing.js`, and Netlify Functions), not just the HTML. Configure Netlify environment variables as documented in `.env.example` and `README.md`.

## 6. Test

Open your site → **Plans & Features** → sign in → **Ask Intelligence** → **AI decision assistant**. Send `Hi! Give me a short introduction.`. Your typed messages go through Supabase Edge Functions to OpenAI. The existing local keyword search still works separately, even without AI.

**Important:** This integration does not sync or transmit your private local decision ledger automatically. ChatGPT subscription access does not cover OpenAI API usage. Before commercial rollout, add monitoring, user/account abuse controls, content policy enforcement, and subscription-based feature entitlements as appropriate.
