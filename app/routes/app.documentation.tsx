import { useState, type ReactNode } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

type AccordionItem = {
  id: string;
  title: string;
  tone?: "info" | "success" | "warning" | "caution" | "neutral";
  content: ReactNode;
};

function DocAccordion({ items }: { items: AccordionItem[] }) {
  const [openId, setOpenId] = useState<string>(items[0]?.id ?? "");

  return (
    <s-stack gap="small">
      {items.map((item, index) => {
        const open = openId === item.id;
        const badgeTone = item.tone ?? "info";
        return (
          <s-box
            key={item.id}
            background={open ? "subdued" : "base"}
            borderWidth="base"
            borderStyle="solid"
            borderColor={open ? "strong" : "subdued"}
            borderRadius="large"
            padding="none"
            overflow="hidden"
          >
            <s-clickable
              padding="base"
              inlineSize="100%"
              background={open ? "subdued" : "transparent"}
              accessibilityLabel={`${open ? "Collapse" : "Expand"} ${item.title}`}
              onClick={() => setOpenId(open ? "" : item.id)}
            >
              <s-stack
                direction="inline"
                justifyContent="space-between"
                alignItems="center"
                gap="base"
                inlineSize="100%"
              >
                <s-stack direction="inline" alignItems="center" gap="small-200">
                  <s-badge
                    tone={open ? badgeTone : "neutral"}
                    color={open ? "strong" : "base"}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </s-badge>
                  <s-text type="strong">{item.title}</s-text>
                </s-stack>
                <s-icon
                  type={open ? "caret-up" : "caret-down"}
                  tone={open ? badgeTone : "neutral"}
                />
              </s-stack>
            </s-clickable>
            {open ? (
              <>
                <s-divider color="strong" />
                <s-box background="base" padding="base">
                  {item.content}
                </s-box>
              </>
            ) : null}
          </s-box>
        );
      })}
    </s-stack>
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "warning" | "info" | "critical";
}) {
  return (
    <s-badge tone={tone} color="strong">
      {label}
    </s-badge>
  );
}

export default function DocumentationPage() {
  const overviewItems: AccordionItem[] = [
    {
      id: "what",
      title: "What this app does",
      tone: "info",
      content: (
        <s-paragraph>
          Rangeela Shipping Manager automates the client's 4-task shipping
          workflow: preorder status emails, the Thursday combined shipping
          invoice, the "new item after shipping paid" alert, and the Friday
          unpaid-invoice reset. The phases below follow the client's original
          project plan, each marked with its current build status.
        </s-paragraph>
      ),
    },
    {
      id: "klaviyo-account",
      title: "Important: correct Klaviyo account",
      tone: "warning",
      content: (
        <s-banner heading="Use the Rangeelaa account" tone="warning">
          <s-paragraph>
            API key and templates belong to{" "}
            <s-text type="strong">
              Rangeelaa — Ethnic Home Decor and Women&apos;s Apparel
            </s-text>
            . Do not build Flows in Alchemy and I Group (or any other
            portfolio account). Switch to Rangeelaa in the bottom-left of
            Klaviyo before setup.
          </s-paragraph>
        </s-banner>
      ),
    },
  ];

  const phaseItems: AccordionItem[] = [
    {
      id: "phase-0",
      title: "Phase 0 — Setup",
      tone: "caution",
      content: (
        <s-stack gap="base">
          <StatusBadge label="Infra — needs manual setup" tone="warning" />
          <s-paragraph>
            Hosting and secrets are outside the app's code and can't be
            verified or completed from here — confirm each manually.
          </s-paragraph>
          <s-ordered-list>
            <s-list-item>
              Heroku app created, GitHub connected for auto-deploy
            </s-list-item>
            <s-list-item>
              Klaviyo API key set —{" "}
              <s-text type="strong">heroku config:set KLAVIYO_API_KEY=pk_...</s-text>{" "}
              , or per-shop in{" "}
              <s-link href="/app/settings">Settings → Klaviyo API key</s-link>{" "}
              (shop-saved key overrides the Heroku env var)
            </s-list-item>
            <s-list-item>
              App scopes include{" "}
              <s-text type="strong">
                read_orders, write_orders, read_draft_orders,
                write_draft_orders
              </s-text>{" "}
              (see <s-text type="strong">shopify.app.toml</s-text>)
            </s-list-item>
            <s-list-item>
              App installed on the dev store — login and session save work
            </s-list-item>
          </s-ordered-list>
        </s-stack>
      ),
    },
    {
      id: "phase-1",
      title: "Phase 1 — Task 1: Preorder Status Emails",
      tone: "success",
      content: (
        <s-stack gap="base">
          <StatusBadge label="Built" tone="success" />
          <s-paragraph>
            Preorders tab has 3 sequential buttons per order. Each adds a
            Shopify tag; a status-email poller then sends the matching
            Klaviyo email and adds a "sent" tag so it never repeats.
          </s-paragraph>

          <s-heading>Tag → Klaviyo mapping</s-heading>
          <s-unordered-list>
            <s-list-item>
              <s-text type="strong">piece-made-notified</s-text> → template{" "}
              <s-text type="strong">WMcvs7</s-text> — "The saree you chose is
              now your dress!" → sent-tag{" "}
              <s-text type="strong">piece-made-email-sent</s-text>
            </s-list-item>
            <s-list-item>
              <s-text type="strong">leaving-for-canada-notified</s-text> →
              template <s-text type="strong">TB2w7d</s-text> — "Guess who's
              flying to Canada? Your Rangeelaa piece!" → sent-tag{" "}
              <s-text type="strong">leaving-email-sent</s-text>
            </s-list-item>
            <s-list-item>
              <s-text type="strong">arrived-in-canada-notified</s-text> (+
              ready-to-ship) → template{" "}
              <s-text type="strong">XmXMMJ</s-text> — "Guess what just
              landed in Canada?" → sent-tag{" "}
              <s-text type="strong">arrived-email-sent</s-text>
            </s-list-item>
          </s-unordered-list>

          <s-heading>Rules</s-heading>
          <s-unordered-list>
            <s-list-item>
              Each email fires once per order — skipped once the sent-tag is
              present
            </s-list-item>
            <s-list-item>
              Steps are sequential — the UI disables a button until the
              previous one is tagged; skirt-deposit orders (tagged{" "}
              <s-text type="strong">group + partial</s-text>) get a single{" "}
              <s-text type="strong">Mark Deposit Fulfilled</s-text> button
              instead
            </s-list-item>
          </s-unordered-list>

          <s-heading>Implementation — Option B (Heroku), sent in real time</s-heading>
          <s-paragraph>
            Client asked to choose between Option A (Shopify Flow → HTTP
            request to Klaviyo) or Option B (extend the Heroku script).{" "}
            <s-text type="strong">Option B was built</s-text>, and it fires{" "}
            <s-text type="strong">immediately</s-text> — clicking a status
            button on the Preorders tab adds the tag and, in the same
            request, calls <s-text type="strong">sendStatusEmailIfNeeded()</s-text>{" "}
            for that order right away. The Status emails tab's "Send pending
            emails now" button and{" "}
            <s-text type="strong">/api/cron/status-emails</s-text> run the
            same logic in bulk (<s-text type="strong">runStatusEmailPoller()</s-text>
            ) as a backfill — for anything that failed on the first try, or
            tags added outside the app (e.g. directly in Shopify Admin).
          </s-paragraph>

          <s-banner tone="warning" heading="Deviation from the original spec">
            <s-paragraph>
              The client's doc specifies{" "}
              <s-text type="strong">POST /api/messages/send/</s-text> for a
              direct template send. That endpoint no longer exists on
              Klaviyo's current API (returns 404). The app instead{" "}
              <s-text type="strong">creates a metric event</s-text> via{" "}
              <s-text type="strong">POST /api/events/</s-text>, and a live
              Klaviyo Flow (triggered by that metric) sends the actual
              email. This means 3 Flows must exist and be{" "}
              <s-text type="strong">Live</s-text> in the Rangeelaa Klaviyo
              account — see "Klaviyo Flow setup" below.
            </s-paragraph>
          </s-banner>

          <s-banner tone="warning" heading="What the email-sent tag actually confirms">
            <s-paragraph>
              The <s-text type="strong">email-sent</s-text> tag only means
              the app successfully asked Klaviyo to send (the event was
              accepted). It does{" "}
              <s-text type="strong">not</s-text> confirm the customer's
              inbox actually received anything — that last step depends
              entirely on the Klaviyo Flow (Live status, template,
              consent). If the tag is present but the customer says they
              got nothing, check the Flow in Klaviyo — the app has no
              visibility past the event-accepted point, and "Send pending
              emails now" will skip that order (it only retries orders
              missing the email-sent tag).
            </s-paragraph>
          </s-banner>
        </s-stack>
      ),
    },
    {
      id: "phase-2",
      title: "Phase 2 — Task 2: Thursday Cycle Script",
      tone: "success",
      content: (
        <s-stack gap="base">
          <StatusBadge label="Built" tone="success" />
          <s-paragraph>
            Runs weekly (or on demand from Tab 03). Combines every
            qualifying order per customer into one draft shipping invoice.
          </s-paragraph>

          <s-heading>2a — Order fetching (Pool 1 + Pool 2)</s-heading>
          <s-paragraph>
            <s-text type="strong">Pool 1 — preorders ready to ship</s-text>:
            tagged arrived-in-canada-notified + ready-to-ship; not tagged
            thursday-email-sent or shipping-paid (exception: included anyway
            if tagged hold-for-next-cycle); Canada/US shipping only, city not
            Saskatoon; no india-only line items.
          </s-paragraph>
          <s-paragraph>
            <s-text type="strong">Pool 2 — RTW Canada/US items</s-text>: at
            least one line item tagged canada or dispatch; paid + unfulfilled
            (partial fulfillment also allowed); same tag/shipping/Saskatoon
            rules as Pool 1; any india line item excludes the whole order
            (mixed orders excluded); only canada/dispatch-tagged line items
            are counted toward the shipping tier — india items never count.
          </s-paragraph>

          <s-heading>2b — Grouping</s-heading>
          <s-paragraph>
            Orders from both pools are grouped by customer email. Saskatoon
            customers never enter either pool (local pickup, no invoice).
          </s-paragraph>

          <s-heading>2c — Draft order creation</s-heading>
          <s-paragraph>
            Canada/dispatch item count → shipping rate (tiered table,
            env-overridable) → one{" "}
            <s-text type="strong">draftOrderCreate</s-text> per customer,
            with a shipping line item and a human-readable note (
            <s-text type="strong">"Combined orders: #1234, #1235"</s-text>).
            The linkage data used later to find the original orders (
            <s-text type="strong">linked_order_ids</s-text>) is stored
            separately in{" "}
            <s-text type="strong">customAttributes</s-text>, which carries
            over to the real order's note_attributes once the draft is paid.
          </s-paragraph>

          <s-heading>2d — Metafield linking</s-heading>
          <s-paragraph>
            The draft order ID is saved on every original order's{" "}
            <s-text type="strong">rangeela.thursday_draft_id</s-text>{" "}
            metafield, so Phase 4 (Task 4b) can find and void it later.
          </s-paragraph>

          <s-heading>2e — Klaviyo email + tagging</s-heading>
          <s-paragraph>
            One combined email (invoice URL + wait URL) via the Thursday
            metric/Flow. All original orders get{" "}
            <s-text type="strong">thursday-email-sent</s-text>;{" "}
            <s-text type="strong">pushed-to-next-weekend</s-text> and{" "}
            <s-text type="strong">hold-for-next-cycle</s-text> are removed if
            present.
          </s-paragraph>

          <s-heading>2f — Hold-for-next-cycle exception</s-heading>
          <s-paragraph>
            An order tagged hold-for-next-cycle is included even if it
            already has shipping-paid — handled by{" "}
            <s-text type="strong">passesCycleTagGate()</s-text>, shared by
            both pools.
          </s-paragraph>

          <s-heading>2g — Route + scheduler</s-heading>
          <s-paragraph>
            <s-text type="strong">/api/cron/thursday</s-text> — POST/GET,
            protected by{" "}
            <s-text type="strong">Authorization: Bearer CRON_SECRET</s-text>{" "}
            (see <s-text type="strong">cron-auth.server.ts</s-text>). Point a
            weekly Heroku Scheduler job at it, or use the "Run Thursday
            cycle now" button on Tab 03 as a manual trigger.
          </s-paragraph>
        </s-stack>
      ),
    },
    {
      id: "phase-3",
      title: "Phase 3 — Task 4a: Friday Reset (Shopify Flow)",
      tone: "caution",
      content: (
        <s-stack gap="base">
          <StatusBadge label="External — configure in Shopify Admin" tone="warning" />
          <s-paragraph>
            This half of Task 4 is a Shopify Flow, not app code — it can't be
            verified or built from this repo. Set it up manually:
          </s-paragraph>
          <s-ordered-list>
            <s-list-item>Shopify Admin → Flow app</s-list-item>
            <s-list-item>
              New workflow → Trigger: <s-text type="strong">Scheduled</s-text>{" "}
              (Friday midnight CST)
            </s-list-item>
            <s-list-item>
              Condition: tag contains{" "}
              <s-text type="strong">thursday-email-sent</s-text> AND NOT{" "}
              <s-text type="strong">shipping-paid</s-text>
            </s-list-item>
            <s-list-item>
              Action: Remove tag thursday-email-sent → Add tag
              pushed-to-next-weekend
            </s-list-item>
            <s-list-item>
              Test with a manually tagged order, or Flow's built-in "test"
              feature
            </s-list-item>
          </s-ordered-list>
          <s-banner tone="info" heading="Fallback already built">
            <s-paragraph>
              If this Flow is missing or doesn't run, Tab 05 → "Run Friday
              backup now" performs this same tag flip{" "}
              <s-text type="strong">and</s-text> the Task 4b draft void
              together, in one manual action.
            </s-paragraph>
          </s-banner>
        </s-stack>
      ),
    },
    {
      id: "phase-4",
      title: "Phase 4 — Task 4b: Draft Order Void",
      tone: "success",
      content: (
        <s-stack gap="base">
          <StatusBadge label="Built" tone="success" />
          <s-paragraph>
            The <s-text type="strong">orders/updated</s-text> webhook watches
            for the <s-text type="strong">pushed-to-next-weekend</s-text> tag
            (added either by the Shopify Flow above, or by the app's own
            Friday backup). When it appears, the app reads the order's{" "}
            <s-text type="strong">rangeela.thursday_draft_id</s-text>{" "}
            metafield and calls{" "}
            <s-text type="strong">draftOrderDelete</s-text> — the old invoice
            stops being payable. Idempotent: if the draft is already gone,
            it's a safe no-op.
          </s-paragraph>
          <s-paragraph>
            Result: the order re-enters the Thursday pool cleanly for the
            next run, with a fresh item count and a new invoice.{" "}
            <s-text type="strong">pushed-to-next-weekend</s-text> is removed
            automatically once that new invoice is sent (Phase 2e).
          </s-paragraph>
        </s-stack>
      ),
    },
    {
      id: "phase-5",
      title: "Phase 5 — Task 3: New Item After Shipping Paid",
      tone: "success",
      content: (
        <s-stack gap="base">
          <StatusBadge label="Built" tone="success" />
          <s-paragraph>
            Tab 04 alerts staff when a customer places a new qualifying
            order after their shipping-paid tag already exists.
          </s-paragraph>
          <s-unordered-list>
            <s-list-item>
              <s-text type="strong">Ship now</s-text> — opens the exact
              order in Shopify Admin for staff to fulfil, add tracking, and
              notify manually. No script/tag action — matches the client's
              "Satya handles manually" requirement exactly.
            </s-list-item>
            <s-list-item>
              <s-text type="strong">Hold for next cycle</s-text> — adds{" "}
              <s-text type="strong">hold-for-next-cycle</s-text>; the order
              leaves the Tab 04 alert list and becomes visible in Tab 03's
              Thursday pool via the Phase 2f exception.
            </s-list-item>
          </s-unordered-list>
          <s-paragraph>
            A new item bought after the Thursday email but{" "}
            <s-text type="strong">before</s-text> payment needs no separate
            handling — Phase 3/4's Friday reset covers it automatically
            (unpaid + thursday-email-sent is exactly what that reset
            targets).
          </s-paragraph>
        </s-stack>
      ),
    },
    {
      id: "phase-6",
      title: "Phase 6 — End-to-End Test + Client Demo",
      tone: "caution",
      content: (
        <s-stack gap="base">
          <StatusBadge label="Manual — run before demo" tone="warning" />
          <s-heading>Full-cycle simulation</s-heading>
          <s-ordered-list>
            <s-list-item>
              Create order → tag through Preorders → confirm status email
            </s-list-item>
            <s-list-item>
              Run Thursday cycle → confirm draft order + combined invoice
              email
            </s-list-item>
            <s-list-item>
              Simulate payment on the draft → confirm original order gets{" "}
              <s-text type="strong">shipping-paid</s-text>
            </s-list-item>
            <s-list-item>
              Leave a different order unpaid → run Friday reset → confirm
              draft voided, tags flipped
            </s-list-item>
            <s-list-item>
              Re-run Thursday cycle → confirm that order reappears with a
              fresh invoice
            </s-list-item>
          </s-ordered-list>
          <s-heading>Edge cases</s-heading>
          <s-unordered-list>
            <s-list-item>Saskatoon customer — excluded entirely</s-list-item>
            <s-list-item>
              Mixed India + Canada line items on one order
            </s-list-item>
            <s-list-item>
              Multiple orders for the same customer combined into one draft
            </s-list-item>
          </s-unordered-list>
        </s-stack>
      ),
    },
  ];

  const referenceItems: AccordionItem[] = [
    {
      id: "manual-thursday-test",
      title: "Reference: Manual Test — Thursday Shipping Invoice",
      tone: "info",
      content: (
        <s-stack gap="small-200">
          <s-unordered-list>
            <s-list-item>Create a fresh normal Shopify order.</s-list-item>
            <s-list-item>
              Use customer email: <s-text type="strong">test@gmail.com</s-text>
            </s-list-item>
            <s-list-item>Use a Canadian shipping address (not Saskatoon).</s-list-item>
            <s-list-item>Keep the order Paid and Unfulfilled.</s-list-item>
            <s-list-item>For isolated testing, add these Shopify tags:</s-list-item>
            <s-list-item>
              <s-unordered-list>
                <s-list-item>arrived-in-canada-notified</s-list-item>
                <s-list-item>ready-to-ship</s-list-item>
              </s-unordered-list>
            </s-list-item>
            <s-list-item>
              Do NOT add: thursday-email-sent, shipping-paid, pushed-to-next-weekend, hold-for-next-cycle
            </s-list-item>
            <s-list-item>Open: Shipping Manager → 03. Thursday invoice</s-list-item>
            <s-list-item>Click: Preview only (no invoices created)</s-list-item>
            <s-list-item>
              Confirm Preview shows: 1 customer, customer email, order number, item count, shipping amount
            </s-list-item>
            <s-list-item>If Preview shows 1 customer, click: Run Thursday cycle now</s-list-item>
          </s-unordered-list>

          <s-heading>Expected Result</s-heading>
          <s-unordered-list>
            <s-list-item>A new Shopify Draft Order is created.</s-list-item>
            <s-list-item>The draft invoice amount is 15.00 CAD for this test case.</s-list-item>
            <s-list-item>The customer receives the Klaviyo Thursday shipping invoice email.</s-list-item>
            <s-list-item>The original order receives the tag: <s-text type="strong">thursday-email-sent</s-text>.</s-list-item>
            <s-list-item>
              The email displays: customer name, item count, shipping total, working Pay Shipping button, working invoice URL.
            </s-list-item>
          </s-unordered-list>

          <s-banner tone="warning" heading="Warning">
            <s-paragraph>
              Use these manual tags only for isolated testing. In the real workflow, status and readiness tags should normally come from the app buttons or the configured automation.
            </s-paragraph>
          </s-banner>

          <s-banner tone="info" heading="Troubleshooting">
            <s-paragraph>If Preview shows 0 customers, check:</s-paragraph>
            <s-unordered-list>
              <s-list-item>order is a normal order, not a draft;</s-list-item>
              <s-list-item>order is Paid;</s-list-item>
              <s-list-item>order is Unfulfilled;</s-list-item>
              <s-list-item>shipping country is Canada;</s-list-item>
              <s-list-item>city is not Saskatoon;</s-list-item>
              <s-list-item>required tags are present;</s-list-item>
              <s-list-item>thursday-email-sent is not already present.</s-list-item>
            </s-unordered-list>
          </s-banner>
        </s-stack>
      ),
    },
    {
      id: "flow-setup",
      title: "Reference: Klaviyo Flow setup (one-time)",
      tone: "success",
      content: (
        <s-stack gap="small-200">
          <s-paragraph>
            Private API key needs scope{" "}
            <s-text type="strong">events:write</s-text>. Create one Flow per
            metric in the Rangeelaa account:
          </s-paragraph>
          <s-ordered-list>
            <s-list-item>
              Klaviyo → Flows → Create flow → Create manually
            </s-list-item>
            <s-list-item>
              Name the flow (example: Rangeela Piece Made)
            </s-list-item>
            <s-list-item>
              Trigger → Your metrics → API → select the matching Rangeela
              metric
            </s-list-item>
            <s-list-item>
              Add Email action → choose the template ID from the Phase 1
              mapping
            </s-list-item>
            <s-list-item>
              Prefer transactional / ignore marketing consent for status emails
            </s-list-item>
            <s-list-item>Set the flow Live (not Draft)</s-list-item>
          </s-ordered-list>
          <s-paragraph>
            Repeat for Leaving, Arrived, and Thursday invoice — 4 Flows
            total.
          </s-paragraph>
        </s-stack>
      ),
    },
    {
      id: "templates",
      title: "Reference: How to find templates in Klaviyo",
      tone: "info",
      content: (
        <s-ordered-list>
          <s-list-item>Left menu → Content → Templates</s-list-item>
          <s-list-item>Open Email: saved</s-list-item>
          <s-list-item>
            Open a template — the short ID is in the browser URL (example:
            .../WMcvs7)
          </s-list-item>
        </s-ordered-list>
      ),
    },
    {
      id: "test",
      title: "Reference: Status-email test checklist",
      tone: "caution",
      content: (
        <s-ordered-list>
          <s-list-item>
            Confirm you are in the Rangeelaa Klaviyo account
          </s-list-item>
          <s-list-item>Confirm the 3 status Flows are Live</s-list-item>
          <s-list-item>
            Use a real customer email (not @example.com — Klaviyo drops those)
          </s-list-item>
          <s-list-item>
            On a test order, click Piece Made (or add piece-made-notified)
          </s-list-item>
          <s-list-item>
            Expect customer email + order tag piece-made-email-sent
          </s-list-item>
          <s-list-item>
            If the app's own send attempt failed (email-sent tag missing),
            use Status emails → Send pending emails now to retry
          </s-list-item>
        </s-ordered-list>
      ),
    },
    {
      id: "tabs",
      title: "Reference: App tabs",
      tone: "info",
      content: (
        <s-unordered-list>
          <s-list-item>
            <s-text type="strong">01. Preorders</s-text> — status buttons
            (Piece Made → Leaving → Arrived) — Phase 1
          </s-list-item>
          <s-list-item>
            <s-text type="strong">02. Status emails</s-text> — Klaviyo
            connection + manual send / preview — Phase 1
          </s-list-item>
          <s-list-item>
            <s-text type="strong">03. Thursday invoice</s-text> — combined
            shipping draft + email — Phase 2
          </s-list-item>
          <s-list-item>
            <s-text type="strong">04. After shipping paid</s-text> — alert
            when a new item is bought after shipping paid — Phase 5
          </s-list-item>
          <s-list-item>
            <s-text type="strong">05. Friday reset</s-text> — backup for
            unpaid Thursday invoices — Phases 3 + 4
          </s-list-item>
        </s-unordered-list>
      ),
    },
    {
      id: "env",
      title: "Reference: Environment variables",
      tone: "caution",
      content: (
        <s-unordered-list>
          <s-list-item>
            <s-text type="strong">KLAVIYO_API_KEY</s-text> — Rangeelaa
            private key (events:write); can be overridden per-shop in{" "}
            <s-link href="/app/settings">Settings</s-link>
          </s-list-item>
          <s-list-item>
            <s-text type="strong">KLAVIYO_THURSDAY_TEMPLATE_ID</s-text> —
            Thursday invoice template ID
          </s-list-item>
          <s-list-item>
            <s-text type="strong">CRON_SECRET</s-text> /{" "}
            <s-text type="strong">CRON_SHOP</s-text> — secured cron routes
          </s-list-item>
          <s-list-item>
            <s-text type="strong">THURSDAY_WAIT_URL</s-text> — wait link in
            Thursday email
          </s-list-item>
        </s-unordered-list>
      ),
    },
    {
      id: "problems",
      title: "Reference: Common problems",
      tone: "warning",
      content: (
        <s-unordered-list>
          <s-list-item>
            <s-text type="strong">sent 0, skipped 0</s-text> — no order has a
            status tag without the matching email-sent tag
          </s-list-item>
          <s-list-item>
            <s-text type="strong">Metric not in Klaviyo</s-text> — wrong
            account, or event not sent yet; search Metrics for
            &quot;Rangeela&quot; in Rangeelaa
          </s-list-item>
          <s-list-item>
            <s-text type="strong">Event OK but no email</s-text> — Flow missing,
            still Draft, or wrong template / consent settings
          </s-list-item>
          <s-list-item>
            <s-text type="strong">Klaviyo 404 on messages/send</s-text> —
            expected; that endpoint is deprecated, the app uses Create Event
            + Flows instead
          </s-list-item>
          <s-list-item>
            <s-text type="strong">Friday reset shows a red "issue(s)"
            toast</s-text> — check the listed reason; "draft already gone" is
            harmless (draft was voided earlier by the webhook or a prior
            run)
          </s-list-item>
        </s-unordered-list>
      ),
    },
  ];

  return (
    <s-page heading="Documentation" inlineSize="large">
      <s-section heading="Overview" padding="base">
        <DocAccordion items={overviewItems} />
      </s-section>

      <s-section heading="Client project plan (Phases 0–6)" padding="base">
        <s-banner heading="Status legend" tone="info">
          <s-paragraph>
            Each phase below is marked{" "}
            <s-text type="strong">Built</s-text>,{" "}
            <s-text type="strong">External</s-text> (Shopify Admin
            config, not app code), or{" "}
            <s-text type="strong">Manual</s-text> (a checklist to run, not
            something to build).
          </s-paragraph>
        </s-banner>
        <DocAccordion items={phaseItems} />
      </s-section>

      <s-section heading="Reference" padding="base">
        <s-banner heading="Lookups and troubleshooting" tone="info">
          <s-paragraph>
            Supporting details referenced from the phases above — template
            IDs, env vars, manual test steps, common problems.
          </s-paragraph>
        </s-banner>
        <DocAccordion items={referenceItems} />
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
