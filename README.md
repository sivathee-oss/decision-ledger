# Decision Ledger — Stripe & Supabase Release

**Start with [`PRODUCTION_READINESS.md`](PRODUCTION_READINESS.md) for the exact launch status and remaining live-payment requirements.**

## Pricing interface update (31 Oct 2026)

The welcome screen now previews Basic / Pro / Elite prices, and the app header has a **Plans** shortcut. The Plans & Features module shows a premium three-card monthly pricing layout, a searchable comparison, a candid sandbox billing notice, and Stripe test checkout via the existing server-side route. **See `PRICING_INTERFACE.md`**. The deployed site is unchanged until the new build is published through Netlify.

# Decision Ledger — Stripe Billing & Invoicing (Sandbox)

This project preserves the uploaded Decision Ledger frontend and adds a Netlify Functions + Stripe + Supabase billing implementation.

## Status

**Implemented in source:** hosted subscription Checkout; Customer Portal; Supabase email OTP sign-in; owner-scoped workspace billing registration; subscription/invoice status; enterprise invoice finalization (administrator only); signature-verified webhooks; idempotent SQL event handling; sample server-side entitlement endpoint.

**Provisioned remotely in sandbox:** Supabase billing and AI quota tables; deployed Supabase `chatgpt` Edge Function; Stripe Pro and Elite monthly sandbox Prices. **Still required:** authentication email delivery and redirects, Stripe API credentials and webhook endpoint, live Netlify deployment, Stripe portal configuration, and OpenAI secret. No real charges, invoices or subscriptions have been made. The existing local-only decision data is not synchronized to Supabase. No multi-user team permission system exists yet. The paid plans do not currently lock or unlock local features.

## Setup

1. Use the already-connected Supabase project `veyrion` (`bfcntfhbkfrwssilxoox`). The billing and AI quota migrations have already been applied remotely; do not rerun them without checking migration history. Enable Email authentication and configure the redirect URL `https://decision-ledger-app.netlify.app/?billing_auth=1#pricing`. For a production application, configure email rate limits, SMTP, and an appropriate sign-in policy.
2. Stripe sandbox recurring Prices already exist: Pro $30/month `price_1UWWWgEUOcgbkYUMet2qiEwC` and Elite $50/month `price_1UWWX9EUOcgbkYUMIl9lrxWQ`. IDs are in `.env.example`. These are TEST prices, not live.
3. In Stripe Customer Portal settings, enable invoice history, payment method changes, and the plan-change options you want. Add a webhook endpoint `https://decision-ledger-app.netlify.app/api/stripe/webhook` and subscribe to: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.finalized`, `invoice.voided`, `invoice.marked_uncollectible`. Copy its signing secret.
4. In Netlify environment variables, configure values listed in `.env.example`. Prefer a Stripe restricted test key with permissions for Checkout Sessions, Customers, Billing Portal Sessions, Subscriptions (read), Invoices, Invoice Items. Keep the Supabase service-role key server-only. **Never expose keys in HTML or Git.**
5. Deploy this **whole project via Netlify Git-based build**, not just `index.html` or manual static drag-and-drop. Build command `npm run build`, publish directory `dist`, functions directory `netlify/functions`. Netlify Functions require dependency installation. Run `npm install` in a network-enabled development environment.
6. Open `/#pricing`, sign in, link your workspace, and test Checkout with Stripe test payment methods. Verify webhook deliveries and the invoice list. For enterprise invoices, set `BILLING_ADMIN_EMAILS` to a verified email; finalize a sandbox invoice and review/send it from the Stripe Dashboard.

## Architecture and limits

The billing service stores workspace billing IDs in Supabase. It never treats the browser's workspace ID as sufficient authorization: the user must authenticate, and server endpoints verify `owner_id`. The **first authenticated user to link an unclaimed local workspace UUID claims its billing record**. This is a migration convenience, not secure proof of ownership of existing local data; do not use it to migrate sensitive or shared production data. Workspace decision content remains browser-local.

The webhook verifies the raw Stripe payload signature and uses an atomic database function to deduplicate Stripe events. Out-of-order invoice events are not fully reconciled; production use should periodically reconcile invoice and subscription state with Stripe. Customer Portal and webhook configuration are external prerequisites.

**Security note:** This is a sandbox integration starter, not a production security certification. Before live payments: migrate to authenticated, server-enforced tenancy and entitlement checks; implement full subscription lifecycle reconciliation (including stale events, duplicate checkout attempts, payment disputes, refunds, and account deletion); configure taxes and registrations, security headers and monitoring, and complete Stripe eligibility and compliance checks. No claim is made that Sri Lanka-based entities are eligible for Stripe live onboarding.

## Files

- `index.html`, `billing.css`, `billing.js`: original Decision Ledger UI plus Stripe panel.
- `netlify/functions`: authenticated backend endpoints and Stripe webhook.
- `supabase/migrations/001_billing.sql`: tables, RLS, atomic webhook RPC.
- `.env.example`: environment variable template, never actual secrets.
- `tests/core.test.mjs`: initial unit tests. Requires `npm install`.

## Verification

All JavaScript files pass `node --check`. Dependencies could not be installed in this isolated environment, so runtime API calls and integration tests have **not** been executed. Stripe sandbox Products and monthly Prices exist, but secret keys and Netlify deployment are not configured.

## Optional AI chat (Supabase Edge Function + OpenAI)

**Deployed on the Supabase project, pending OPENAI_API_KEY setup.** The Ask Intelligence page now contains a separate AI chat card. It does not replace the original evidence-based keyword retrieval. It sends only text entered into the AI chat (and its short in-memory chat history); it does **not** upload browser-local decisions or workspaces. AI output is not verified evidence.

### Configure

1. Finish the **Supabase Auth** and Netlify billing configuration above. The AI card reuses the Supabase client and email sign-in session created by `billing.js`.
2. The `002_ai_quota` migration has already been applied to the connected Supabase project; no rerun required. It installs an atomic, per-user UTC-day request limit, default **25 requests/day**. The Edge Function fails closed if the quota database call fails. This is a basic spend guard, not a complete abuse prevention system.
3. In your Supabase project, open **Edge Function Secrets** and set `OPENAI_API_KEY` to your **own** OpenAI API key. Never put the secret in Netlify's HTML, browser JavaScript, or source control. Optional secrets: `OPENAI_MODEL=gpt-4o-mini`, `AI_ALLOWED_ORIGINS=https://decision-ledger-app.netlify.app`, `AI_DAILY_REQUEST_LIMIT=25`. Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` for hosted functions. If your project uses only new publishable keys, the function also accepts `SUPABASE_PUBLISHABLE_KEY`; verify the required server-side admin secret is available before deploying.
4. The function is deployed as `chatgpt` on Supabase; for any subsequent updates, with the Supabase CLI authenticated and linked to the **correct project**, redeploy:

   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy chatgpt
   ```

   `supabase/config.toml` keeps `verify_jwt = true`. **Do not** deploy with `--no-verify-jwt`. The handler also validates the user token against Supabase Auth before charging the request quota.
5. Deploy the **whole updated Netlify project**. Navigate to **Ask Intelligence**, sign in through **Plans & Features**, and send a message. If you see a configuration error, verify Netlify billing config, Supabase Edge Function logs, database migration, and OpenAI API billing.

### Privacy, usage, and limits

- OpenAI API usage incurs charges against your OpenAI API account independently of Stripe subscriptions; a ChatGPT subscription does not provide API credits.
- Only signed-in users can invoke the Edge Function; the browser origin is allowlisted. Server checks authentication, prompt length (1–4000), history (up to eight messages), and an atomic request quota before calling OpenAI.
- Conversations are stored only in the current browser tab's JavaScript memory; they disappear on reload. Do not submit confidential decision data unless authorized to transmit it to an external model.
- No automatic grounding in local decisions, retrieval-augmented generation, audit trail, moderation pipeline, subscription entitlement gating, or production-grade per-IP anti-abuse is implemented. Add these before commercial rollout as needed.
- For local testing, set `AI_ALLOWED_ORIGINS` to a comma-separated allowlist that includes your local development origin; do not use `*` in production.

### Relevant source

- `supabase/functions/chatgpt/index.ts`: authenticated AI proxy, strict CORS, request limits, server-side key.
- `supabase/migrations/002_ai_quota.sql`: quota table + service-role-only RPC.
- `ai-chat.js`, `ai-chat.css`: integrated AI chat panel inside Ask Intelligence.
- `billing.js`: exposes a read-only accessor to its existing Supabase client for the chat panel.

### Smoke tests

- Logged out: submitting a chat message asks the user to sign in.
- Signed in: the Edge Function accepts a short prompt and returns `{ "answer": "..." }`.
- More than 25 requests in a UTC day: HTTP 429 (with default quota).
- Unsupported browser origin: HTTP 403. Unsupported HTTP method: HTTP 405.
- Missing OpenAI secret: HTTP 503. Failed OpenAI upstream request: HTTP 502.
- Existing Ask Intelligence keyword retrieval still works without the AI service.


## Welcome experience: penultimate pricing chapter

The complete **Subscriptions & Features** chapter now sits directly after the interactive product preview and before the final getting-started chapter. It is accessible through the landing chapter rail; Basic, Pro and Elite cards include six highlights each, expandable full feature comparison, and clear Stripe sandbox disclosures. Paid CTAs lead to workspace setup or to the in-app pricing/billing page. This does **not** activate live payments or make server-side feature entitlements functional.
