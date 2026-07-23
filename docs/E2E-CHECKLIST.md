# End-to-end checklist (dev store demo)

Use this before client demo / production deploy.

## Happy path

- [ ] App installs; login/session works on the store  
- [ ] `KLAVIYO_API_KEY` set; Klaviyo banner green in app  
- [ ] Tag `piece-made-notified` → email + `piece-made-email-sent`  
- [ ] Tag `leaving-for-canada-notified` → email + `leaving-email-sent`  
- [ ] Tag `arrived-in-canada-notified` (+ `ready-to-ship`) → email + `arrived-email-sent`  
- [ ] Second tag attempt does **not** send duplicate email  
- [ ] Thursday dry run lists expected customers/orders  
- [ ] Thursday run creates **one** draft per email with note `Combined orders: ...`  
- [ ] Original orders get `thursday-email-sent`; metafield `rangeela.thursday_draft_id` set  
- [ ] `pushed-to-next-weekend` / `hold-for-next-cycle` cleared when included  
- [ ] Invoice Klaviyo sends when `KLAVIYO_THURSDAY_TEMPLATE_ID` is set  
- [ ] After shipping paid alert shows for new qualifying order; Hold adds `hold-for-next-cycle`  
- [ ] Hold order appears in next Thursday pool even with `shipping-paid`  
- [ ] Flow (or backup Friday run) removes `thursday-email-sent`, adds `pushed-to-next-weekend`  
- [ ] Draft order is deleted when pushed tag is added  
- [ ] Next Thursday creates a fresh invoice for unpaid orders  

## Edge cases

- [ ] Saskatoon shipping city excluded entirely  
- [ ] India-only / mixed India+Canada orders excluded from Pool 2  
- [ ] Shipping count uses only `canada` / `dispatch` line items  
- [ ] Multiple orders same customer → single draft  
- [ ] Order without email skipped for status email (no crash)  
- [ ] Missing Thursday template: draft+tags still created; email error noted  

## Production cutover

- [ ] Heroku config vars set (see operations.md)  
- [ ] GitHub auto-deploy connected  
- [ ] Scheduler Thursday job live  
- [ ] Shopify Flow Friday live  
- [ ] `shopify app deploy` — production webhooks registered  
- [ ] Smoke-test one real/staging order on production store  
