# Decision Ledger

Private workspace for recording important decisions, tracking assumptions and outcomes, and building organisational memory.

## Live site (published)

**https://decision-ledger-app.netlify.app/**

Public, no password. Includes:

- Dark mode + mobile layout
- CookieYes consent banner
- Google Analytics 4 (`G-L1GB3P5SB8`) with Consent Mode
- Privacy & Terms pages
- robots.txt + sitemap.xml

## Custom domain (not yet)

`decisionledger.app` is not registered/resolving yet. After you buy it:

1. Netlify → decision-ledger-app → Domain management → Add `decisionledger.app`
2. Cloudflare DNS (DNS only):
   - CNAME `@` → `decision-ledger-app.netlify.app`
   - CNAME `www` → `decision-ledger-app.netlify.app`
3. Wait for SSL, then update canonical/sitemap to the custom domain

## Repository

https://github.com/sivathee-oss/decision-ledger

```bash
curl -o index.html https://decision-ledger-app.netlify.app/
git add index.html && git commit -m "Sync full app" && git push
```

## Feedback

feedback@decisionledger.app
