# Phase 0 — Setup status

## Done in this repo

- [x] Project folder: `rangeela-shipping-manager`
- [x] Required scopes in `shopify.app.toml`:
  - `read_orders`, `write_orders`, `read_draft_orders`, `write_draft_orders`
  - (+ `read_customers`, `read_products` for Thursday cycle)
- [x] Klaviyo key wired via env (`KLAVIYO_API_KEY`)
- [x] Prisma switched to **PostgreSQL** (`DATABASE_URL`)
- [x] `docker-compose.yml` for local Postgres (if Docker installed)
- [x] `Procfile` + `app.json` for Heroku
- [x] `orders/updated` webhook subscription (used in Phase 1+)
- [x] Ops docs: `docs/operations.md`, `docs/E2E-CHECKLIST.md`

## Blocked on your machine / account

### 1. Heroku app create
`heroku create` fails with **account verification required** (add payment method):  
https://heroku.com/verify

After verify, run:

```bash
heroku create rangeela-shipping-manager
heroku addons:create heroku-postgresql:essential-0 -a rangeela-shipping-manager
heroku config:set KLAVIYO_API_KEY=pk_... CRON_SECRET=... CRON_SHOP=test-email-store-ojktyeff.myshopify.com -a rangeela-shipping-manager
# also SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SCOPES, SHOPIFY_APP_URL, DATABASE_URL (auto from postgres addon)
```

Or use helper: `bash scripts/heroku-setup.sh rangeela-shipping-manager test-email-store-ojktyeff.myshopify.com`

### 2. Local Postgres
Docker is not installed. Options:
- Install Docker Desktop → `docker compose up -d`
- Or install PostgreSQL and create DB `rangeela_shipping` / user `rangeela`
- Or after Heroku Postgres exists: `heroku config:get DATABASE_URL -a rangeela-shipping-manager` and put that in local `.env` (only for temporary migrate/test)

### 3. GitHub
Create repo + push after first commit (see below). Needs `gh` auth or create empty repo on github.com and:

```bash
git remote add origin https://github.com/YOUR_USER/rangeela-shipping-manager.git
git push -u origin main
```

Then Heroku Dashboard → Deploy → Connect GitHub → enable auto-deploy.

### 4. Dev store install test
With `shopify app dev` running:
1. Restart after Postgres `DATABASE_URL` works
2. Open preview URL
3. Approve scopes
4. Confirm app home loads (session row in DB)

## Local DATABASE_URL

```
DATABASE_URL=postgresql://rangeela:rangeela@localhost:5432/rangeela_shipping?schema=public
```
