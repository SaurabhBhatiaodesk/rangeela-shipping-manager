# Phase 0 — Setup status

## Done in this repo

- [x] Project folder: `rangeela-shipping-manager`
- [x] Initial git commit on `main`
- [x] Required scopes in `shopify.app.toml`
- [x] Klaviyo key via env (`KLAVIYO_API_KEY`)
- [x] Local DB: SQLite (`DATABASE_URL=file:dev.sqlite`) so `shopify app dev` works
- [x] `docker-compose.yml` ready for local Postgres when Docker is installed
- [x] `Procfile` + `app.json` for Heroku
- [x] Ops docs

## Repo status

- Git commit done locally.
- GitHub remote / Heroku app **not** created yet (blockers below).

## You must complete these (I cannot finish without your accounts)

### 1. Verify Heroku account
https://heroku.com/verify (payment method)  
Then tell me — I will run `heroku create`, Postgres addon, and config vars.

### 2. Create GitHub repo + push
Install GitHub CLI or create empty repo on github.com, then:

```bash
git remote add origin https://github.com/YOUR_USER/rangeela-shipping-manager.git
git push -u origin main
```

Connect Heroku → GitHub auto-deploy.

### 3. Optional local Postgres
Install Docker Desktop → `docker compose up -d`  
Then switch Prisma to `postgresql` (see `docs/operations.md`) before Heroku production.

### 4. Restart shopify app dev
Approve new scopes; open app preview; confirm home loads.
