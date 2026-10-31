# Decision Ledger — launch checklist (31 October 2026)

**Launch status:** Supabase backend provisioned; AI function deployed with JWT validation; Stripe sandbox monthly Prices created. **Netlify app has NOT been redeployed and real payments are NOT active.**

## Verified configuration

- Supabase project: `veyrion` (`bfcntfhbkfrwssilxoox`)
- Supabase URL: `https://bfcntfhbkfrwssilxoox.supabase.co`
- Stripe account: VEYRION sandbox (`livemode=false`)
- Pro: USD $30/month `price_1UWWWgEUOcgbkYUMet2qiEwC`
- Elite: USD $50/month `price_1UWWX9EUOcgbkYUMIl9lrxWQ`
- Deployed Edge Function: `https://bfcntfhbkfrwssilxoox.supabase.co/functions/v1/chatgpt` (requires user auth and private `OPENAI_API_KEY`)

## Steps requiring account-owner access

1. **OpenAI:** Finish OpenAI Platform API key creation. In Supabase > Project settings > Edge Function Secrets, set `OPENAI_API_KEY` (do not send it in chat or commit it). Ensure API billing is enabled, set a low usage/spend cap and test a signed-in AI request.
2. **Supabase Authentication:** Enable email sign-in, add `https://decision-ledger-app.netlify.app/?billing_auth=1` to Auth URL configuration allowed redirect URLs (hash anchors are client-side and do not need to be allowlisted separately), and verify email delivery/SMTP. Sign-in should be tested before charging users.
3. **Netlify:** Connect the full project repository to your **existing** Decision Ledger site, not a newly created site. The supplied `netlify.toml` builds with `npm run build`, publishes only `dist/`, and bundles `netlify/functions` outside the public directory. An authenticated Netlify Git deployment is strongly recommended.
4. **Netlify environment variables:** Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY` (public publishable key), `SUPABASE_SERVICE_ROLE_KEY` (secret), `STRIPE_API_KEY` (sandbox restricted key), `STRIPE_PRICE_PRO_MONTH`, `STRIPE_PRICE_ELITE_MONTH`, `STRIPE_TEST_MODE=true`, `STRIPE_WEBHOOK_SECRET`, and `SITE_URL=https://decision-ledger-app.netlify.app`. The non-secret examples are in `.env.example`. Set the sensitive values only via Netlify's protected environment variable manager. `STRIPE_WEBHOOK_SECRET` is obtained after creating the webhook endpoint.
5. **Stripe webhook:** In the **test** Stripe Dashboard, add `https://decision-ledger-app.netlify.app/api/stripe/webhook`. Subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.finalized`, `invoice.voided`, `invoice.marked_uncollectible`. Copy the signing secret into Netlify.
6. **Stripe Customer Portal:** Configure the sandbox portal policy to enable permitted subscription changes and invoice history.
7. **Acceptance test:** Visit `https://decision-ledger-app.netlify.app/api/billing/config` and confirm `configured:true` and `testMode:true`. Verify Supabase email sign-in, workspace link, Pro sandbox Checkout, Stripe webhook delivery, paid status, portal, test invoice and AI chat. Never grant access based solely on returning from Checkout.

## Critical limits

- Paid access is NOT enforced across Decision Ledger's browser-local tools. This is a billing integration starter, **not** a full secure monetized SaaS launch. Multi-user collaboration, cloud sync, server-side feature entitlements, and appropriate business/legal/tax eligibility must be addressed before charging customers in live mode.
- The owner must have a Stripe-eligible business and correct tax registration where applicable before switching to live keys.
- Supabase `billing_events` and `ai_usage_daily` tables intentionally have no read policies for general users; only backend service role accesses them. The most recent security advisor pass showed no warnings, only these expected informational notices.
- No private keys are stored in this project. Without Netlify deployment access, this package cannot be published to the existing live site from this chat.

## Safety-first smoke test after deployment

```sh
curl -i https://decision-ledger-app.netlify.app/api/billing/config
# Expected after Netlify environment setup: HTTP 200 and configured:true, testMode:true.

curl -i https://decision-ledger-app.netlify.app/api/billing/status
# Expected without sign-in: HTTP 401. A public billing status is a deployment bug.
```

Do not publish the repository root as a static directory: only the `dist/` folder is safe for public static hosting. Netlify should bundle Functions separately.
