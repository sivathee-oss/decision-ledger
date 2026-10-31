# Connected Supabase deployment status — 31 October 2026

Project: `veyrion` (`bfcntfhbkfrwssilxoox`), active, region eu-west-3.

## Completed remotely

- Created `public.billing_workspaces`, `public.billing_invoices`, `public.billing_events`, `public.ai_usage_daily` with RLS enabled.
- Installed `billing_apply_event` and `consume_ai_quota` database functions with service-role-only execute privileges.
- Deployed `chatgpt` Edge Function version 1 with JWT verification enabled at `https://bfcntfhbkfrwssilxoox.supabase.co/functions/v1/chatgpt`.
- Verified the new tables exist and function is ACTIVE. The OpenAI API request path has NOT been tested end to end.
- Configured the publicly shareable Supabase URL and publishable key in `.env.example`; these are not secrets.

## Not completed

- `OPENAI_API_KEY` must be added in Supabase Edge Function Secrets; without it the AI endpoint returns 503.
- Netlify account is not connected for deployment; existing live website has not been changed.
- Netlify server-only secrets `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET` must be configured by the owner; no secret values should be placed in source files.
- Stripe sandbox Pro $30 and Elite $50 monthly Prices have been created and recorded in `.env.example`; the webhook endpoint, billing portal and Stripe API key are NOT configured. Stripe live-mode onboarding and tax registration remain separate.
- Supabase Auth email redirect must be allowlisted and verified; email SMTP/deliverability should be checked.
- The Supabase security advisor initially flagged `public.rls_auto_enable()` as executable by anonymous and authenticated users. Its definition was inspected; PUBLIC/anon/authenticated EXECUTE was revoked by migration. The advisor was rerun and only informational no-policy notices remained for backend-only RLS tables.
- The database is for billing and AI quota only; decision content remains in browser local storage and paid entitlements are not enforced for the offline UI.

## Tests

- `npm run build`: passed (static source validation).
- `npm run check`: passed (JavaScript syntax).
- `npm test`: 3 AI source tests passed; Stripe core tests blocked because npm dependencies were not installed in this environment (`ERR_MODULE_NOT_FOUND: stripe`). This is not an end-to-end pass.

## Required next steps

1. Configure OpenAI secret in Supabase dashboard. Do not paste it into chat.
2. Connect Netlify (or grant deploy access) and set server-only environment variables there.
3. Create/confirm Stripe sandbox Prices, configure the webhook and Customer Portal, then set the Price IDs.
4. Deploy whole project, test auth, Checkout, webhook processing, invoice and AI responses before taking live payments.

## Deployment safeguards
- Netlify now publishes only `dist/` (5 public assets), not the project root; backend code and migrations stay outside the public directory.
- No Netlify deployment credentials or private Stripe/Supabase/OpenAI secrets are connected in this conversation, so publishing and live AI/Checkout tests remain blocked.
