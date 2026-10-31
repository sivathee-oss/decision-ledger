# Decision Ledger — Pricing interface update (31 October 2026)

## Where customers see pricing

- **Welcome screen:** concise Basic / Pro / Elite price preview.
- **App header:** persistent **Plans** button; opens the existing Workspace → Plans & Features module.
- **Plans & Features:** redesigned three-card monthly USD pricing and one primary action per card.
- **Compare the plans:** the original searchable feature matrix remains available.
- **Billing management:** existing authenticated Stripe billing panel, subscription status, Customer Portal and administrator invoicing are retained under the plans.
- **FAQ:** clarifies test mode, pricing units, cancellations and cloud limitations.

## Current prices (Stripe sandbox)

- Basic: free to use in this browser.
- Pro: USD $30 **per workspace per month**. Stripe sandbox Price `price_1UWWWgEUOcgbkYUMet2qiEwC`.
- Elite: USD $50 **per workspace per month**. Stripe sandbox Price `price_1UWWX9EUOcgbkYUMIl9lrxWQ`.

No annual pricing was created, so the UI does not offer an annual switch or savings claims.

## Honest product status

This is a browser-local early-access application. Pricing tiers currently represent *proposed packaging* and Stripe test subscriptions; the integration does **not** yet provide production subscription entitlements, cloud synchronization, team collaboration, or production payment capability. The sandbox will not charge real money.

The UI has been developed and statically checked, but the hosted Netlify site has **not** been redeployed. A production launch requires private Netlify environment variables, Stripe webhook configuration, complete authentication/payment tests, and verification of live Stripe eligibility.

## Test results

- `npm run build` — passed; `dist` contains only five public frontend assets.
- Inline JS from `index.html`: `node --check` passed for all inline blocks.
- `node --check billing.js` — passed.
- `node --test tests/pricing-ui.test.mjs` — 5 tests passed.
- Visual/browser testing was attempted but blocked by browser administration policy; no claim of verified browser rendering is made.

## Deployment

Use the existing `netlify.toml` with Git-backed Netlify deploys. The Netlify build command is `npm run build` and publish directory is `dist`. **Do not** drag-drop the project ZIP directly as a static Netlify deploy, as the protected serverless functions need a proper Netlify Functions deployment.

Do not put Stripe or Supabase secret keys in frontend code. Use the existing `.env.example` strictly as a template for Netlify environment variables.
