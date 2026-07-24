# Rangeela Shipping Manager — Operations

## Architecture (final)

| Task | Primary mechanism |
|------|-------------------|
| Status → Klaviyo email | `orders/updated` webhook |
| Thursday combined invoice | Heroku Scheduler → `POST /api/cron/thursday` |
| Friday unpaid tag flip | Shopify Flow (scheduled) |
| Friday draft void | Same `orders/updated` webhook when `pushed-to-next-weekend` appears |
| Hold for next cycle | App UI tag `hold-for-next-cycle` |

---

## Phase 0 — Heroku setup

**Note:** `heroku create` requires a verified Heroku account (payment method).  
If create fails with `verification_required`, verify at https://heroku.com/verify  
or reuse an existing app (e.g. collaborated `rangeelaa-thursday-emails`).

```bash
# From repo root (requires Heroku CLI login + verified account)
heroku create rangeela-shipping-manager
heroku git:remote -a rangeela-shipping-manager

# Or attach existing app:
# heroku git:remote -a rangeelaa-thursday-emails

heroku config:set KLAVIYO_API_KEY=pk_YOUR_KEY
heroku config:set KLAVIYO_THURSDAY_TEMPLATE_ID=YOUR_TEMPLATE_ID
heroku config:set CRON_SECRET=generate-a-long-random-string
heroku config:set CRON_SHOP=your-store.myshopify.com
heroku config:set THURSDAY_WAIT_URL=https://your-wait-page.example

# Also set Shopify app secrets from Partners / `shopify app env show`
heroku config:set SHOPIFY_API_KEY=...
heroku config:set SHOPIFY_API_SECRET=...
heroku config:set SCOPES=read_orders,write_orders,read_customers,write_draft_orders,read_draft_orders,read_products,write_products,write_metaobjects,write_metaobject_definitions
heroku config:set SHOPIFY_APP_URL=https://YOUR_APP.herokuapp.com

heroku addons:create scheduler:standard
```

Helper script: `scripts/heroku-setup.sh` (after verify).

GitHub auto-deploy: Heroku Dashboard → Deploy → Connect GitHub → enable automatic deploys on `main`.

Also see [`app.json`](../app.json) + [`Procfile`](../Procfile) for Heroku button / build.

Scheduler jobs (Heroku → Scheduler → Add job):

```bash
# Every 10 min optional backfill (webhook is primary for status emails)
curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" "$SHOPIFY_APP_URL/api/cron/status-emails"

# Thursday ~9:00 America/Chicago (adjust cron for your TZ)
curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" "$SHOPIFY_APP_URL/api/cron/thursday"
```

Friday tag flip is **Flow**, not Scheduler. Optional backup:

```bash
curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" "$SHOPIFY_APP_URL/api/cron/friday"
```

After deploy, run `shopify app deploy` so `orders/updated` webhook points at production URL.

---

## Phase 3 — Shopify Flow (Friday midnight CST)

1. Shopify Admin → **Flow** app → Create workflow  
2. Trigger: **Scheduled time** → Friday `00:00` → timezone `America/Chicago` (CST/CDT)  
3. Action: **Get order data** / loop unpaid thursday orders, or use “Order tags” conditions as supported by your Flow version  
4. Condition: tag contains `thursday-email-sent` AND does **not** contain `shipping-paid`  
5. Actions:  
   - Remove order tag `thursday-email-sent`  
   - Add order tag `pushed-to-next-weekend`  
6. Save + turn on  

When `pushed-to-next-weekend` is added, `orders/updated` deletes the draft stored in metafield `rangeela.thursday_draft_id`.

---

## Klaviyo setup (required — replaces dead `/api/messages/send/`)

Klaviyo’s public API **cannot** send a template by ID directly. The app posts a
**Create Event** (`POST /api/events/`). You must create a **metric-triggered Flow**
for each email so Klaviyo actually sends it.

Private API key needs scope **`events:write`**.

| App metric name | Flow email template | Shopify trigger tag |
|-----------------|---------------------|---------------------|
| `Rangeela Piece Made` | `WMcvs7` | `piece-made-notified` |
| `Rangeela Leaving for Canada` | `TB2w7d` | `leaving-for-canada-notified` |
| `Rangeela Arrived in Canada` | `XmXMMJ` | `arrived-in-canada-notified` |
| `Rangeela Thursday Shipping Invoice` | set `KLAVIYO_THURSDAY_TEMPLATE_ID` | Thursday cron |

For each row:

1. Klaviyo → **Flows** → Create flow → trigger **Metric** → pick the metric name  
   (after the first successful app send, the metric appears; or create flow after a test event)  
2. Add **Email** action → use the template ID above  
3. Mark the flow email as **transactional** if you want it to bypass marketing consent  
4. Set flow **Live**

Thursday Flow properties available in the template: `invoice_url`, `wait_url`,
`order_names`, `shipping_amount`.

---

## Phase 1 — Manual webhook test

1. Ensure the 3 status Flows above are **Live**  
2. Ensure `shopify app dev` is running (or production webhook registered)  
3. Open a paid test order with a **real** customer email (not `@example.com` — those events are dropped)  
4. Add tag `piece-made-notified` in Admin  
5. Expect: Klaviyo event + Flow email for `WMcvs7` + tag `piece-made-email-sent`  
6. Repeat with `leaving-for-canada-notified` → `TB2w7d` → `leaving-email-sent`  
7. Repeat with `arrived-in-canada-notified` (+ `ready-to-ship`) → `XmXMMJ` → `arrived-email-sent`  

---

## Phase 2 — Thursday dummy orders

Create 4–5 orders covering:

- Pool 1: `arrived-in-canada-notified` + `ready-to-ship`, CA/US address, not Saskatoon  
- Pool 2: paid, unfulfilled, product tags `canada` or `dispatch`, no `india`  
- Same email on 2–3 orders (must combine)  
- Saskatoon address (must exclude)  
- `hold-for-next-cycle` + `shipping-paid` (must include)  

Then: App → Thursday invoice → Dry run → Run cycle.

---

## Phase 6 — End-to-end checklist

See [E2E-CHECKLIST.md](./E2E-CHECKLIST.md).
