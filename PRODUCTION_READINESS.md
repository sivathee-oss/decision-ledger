# Decision Ledger — payment launch checklist

## Current status (31 October 2026)

This repository contains a full local-first Decision Ledger UI, the penultimate subscription-pricing landing chapter, original two-tone vector identity, authenticated Netlify Stripe Billing functions, a Stripe-hosted Checkout redirect, Customer Portal, administrator-only enterprise invoice creation, and verified Stripe webhooks. The Supabase database schema and signed-in AI proxy are deployed to project `bfcntfhbkfrwssilxoox`. The Stripe Prices below are **sandbox-only**.

**No production payment acceptance yet.** The only connected Stripe account is `VEYRION sandbox` (livemode false). Live charges require a verified live Stripe merchant account in a supported jurisdiction, live Prices, restricted live API keys, production webhook secret, dashboard portal settings, tax determination and a successful end-to-end test.

## Sandbox products and Prices

- Pro monthly: `price_1UWWWgEUOcgbkYUMet2qiEwC` — $30 USD per workspace.
- Elite monthly: `price_1UWWX9EUOcgbkYUMIl9lrxWQ` — $50 USD per workspace.
- Basic: free (no Stripe subscription).
- Annual recurring prices have **not** been created. Do not advertise yearly billing until they exist.

## Required Netlify configuration

In Netlify Site Configuration > Environment variables, add all variables from `.env.example`. **Never commit server secrets.** Prefer least-privilege restricted Stripe API keys. `STRIPE_TEST_MODE=true` intentionally refuses live keys. In live mode set `STRIPE_TEST_MODE=false`, real live Price IDs and a real live key together.

The build command is `npm run build`; publish `dist`; functions `netlify/functions`. For public builds, the package intentionally publishes only five frontend assets. Netlify installs `@supabase/supabase-js` and `stripe` to bundle functions. You need a working network-enabled build system; the isolated workspace used to prepare this release could not fetch dependencies.

## Supabase auth

- Supabase project: `https://bfcntfhbkfrwssilxoox.supabase.co`.
- Email OTP login must be enabled, with allowed redirect `https://decision-ledger-app.netlify.app/?billing_auth=1` (including any preview domain used for testing).
- `billing_workspaces` billing records have an authenticated `owner_id` and RLS. Workspace decisions remain browser-local; the billing backend does **not** sync, securely gate, or validate the ownership of older local browser decision data. Treat existing premium feature descriptions as planned until implemented and hosted.
- The Edge Function `chatgpt` is already active, but replies require a private `OPENAI_API_KEY` secret and API billing.

## Stripe Dashboard configuration

1. Add webhook destination `https://decision-ledger-app.netlify.app/api/stripe/webhook` (or exact preview site URL).
2. Subscribe to: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.finalized`, `invoice.voided`, `invoice.marked_uncollectible`, `charge.dispute.created`, `charge.refunded`, `radar.early_fraud_warning.created`.
3. Set `STRIPE_WEBHOOK_SECRET` to the *same environment* endpoint signing secret.
4. Configure Stripe Billing Customer Portal to allow payment method changes, cancellations, invoice downloads and desired plan-switch options.
5. Test sign-in, Checkout success and cancellation, webhook deliveries, Customer Portal, a renewal and failed invoice, cancellation, enterprise invoice creation, refund and dispute alerts, duplicate webhook delivery and risk hold.
6. Determine sales tax/VAT/GST obligations and registrations; do not enable Stripe Tax until the appropriate registrations are configured. Use Stripe Dashboard taxes setup and seek professional advice for cross-border sales.

## Operational controls

The billing webhook verifies Stripe's raw request signature before processing, deduplicates events through a service-role-only database RPC, and holds premium API entitlements on a charge refund, dispute or early fraud warning. Risk holds must be reviewed manually in Supabase and Stripe; there is no automated clearing flow. Out-of-order subscription events and database/Stripe reconciliation should be monitored. For higher assurance, add automated reconciliation, invoice state ordering, fraud operations, audit retention and alerting.

## Business requirements

A live Stripe account needs a legitimately registered and eligible merchant with authorized representatives. If business registration is in Sri Lanka, verify processor eligibility or an alternative provider; a sandbox is not evidence of live eligibility. Do not use false addresses or identity information to attempt onboarding. Merchant representatives must meet provider legal age/consent rules.

## Code verification

`npm run build` and `node --check` completed. Twelve frontend and AI integration tests passed, plus new static payment hardening tests. Full functional Stripe SDK tests, actual billing/portal redirects, webhook delivery and production deployment remain unverified because no private Netlify deployment keys, live Stripe merchant, or npm registry access was available during preparation.
