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
  const [openId, setOpenId] = useState<string>(
    items.find((i) => i.id === "klaviyo-account")?.id ?? items[0]?.id ?? "",
  );

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

export default function DocumentationPage() {
  const items: AccordionItem[] = [
    {
      id: "what",
      title: "What this app does",
      tone: "info",
      content: (
        <s-paragraph>
          Rangeela Shipping Manager tracks preorder status tags, sends Klaviyo
          status emails, builds Thursday combined shipping invoices, alerts when
          a customer buys again after shipping is paid, and supports the Friday
          unpaid-invoice reset.
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
            . Do not build Flows in Alchemy and I Group (or any other portfolio
            account). Switch to Rangeelaa in the bottom-left of Klaviyo before
            setup.
          </s-paragraph>
        </s-banner>
      ),
    },
    {
      id: "how-emails",
      title: "How status emails work",
      tone: "info",
      content: (
        <s-stack gap="small-200">
          <s-paragraph>
            The app does not send a Klaviyo template by ID directly (that API
            path no longer exists). Instead:
          </s-paragraph>
          <s-unordered-list>
            <s-list-item>
              Shopify tag is added (app button or Admin)
            </s-list-item>
            <s-list-item>
              App creates a Klaviyo metric event via API
            </s-list-item>
            <s-list-item>
              A live Klaviyo Flow (triggered by that metric) sends the email
            </s-list-item>
            <s-list-item>
              App adds an email-sent tag so the same email is not sent again
            </s-list-item>
          </s-unordered-list>
        </s-stack>
      ),
    },
    {
      id: "mapping",
      title: "Status tag → Klaviyo mapping",
      tone: "success",
      content: (
        <s-unordered-list>
          <s-list-item>
            Tag <s-text type="strong">piece-made-notified</s-text> → metric
            &quot;Rangeela Piece Made&quot; → template{" "}
            <s-text type="strong">WMcvs7</s-text> → tag{" "}
            <s-text type="strong">piece-made-email-sent</s-text>
          </s-list-item>
          <s-list-item>
            Tag <s-text type="strong">leaving-for-canada-notified</s-text> →
            metric &quot;Rangeela Leaving for Canada&quot; → template{" "}
            <s-text type="strong">TB2w7d</s-text> → tag{" "}
            <s-text type="strong">leaving-email-sent</s-text>
          </s-list-item>
          <s-list-item>
            Tag <s-text type="strong">arrived-in-canada-notified</s-text> (+
            ready-to-ship) → metric &quot;Rangeela Arrived in Canada&quot; →
            template <s-text type="strong">XmXMMJ</s-text> → tag{" "}
            <s-text type="strong">arrived-email-sent</s-text>
          </s-list-item>
          <s-list-item>
            Thursday invoice → metric &quot;Rangeela Thursday Shipping
            Invoice&quot; → template from{" "}
            <s-text type="strong">KLAVIYO_THURSDAY_TEMPLATE_ID</s-text>
          </s-list-item>
        </s-unordered-list>
      ),
    },
    {
      id: "manual-thursday-test",
      title: "Manual Test — Thursday Shipping Invoice",
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
      title: "Klaviyo Flow setup (one-time)",
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
              Add Email action → choose the template ID from the mapping above
            </s-list-item>
            <s-list-item>
              Prefer transactional / ignore marketing consent for status emails
            </s-list-item>
            <s-list-item>Set the flow Live (not Draft)</s-list-item>
          </s-ordered-list>
          <s-paragraph>
            Repeat for Leaving, Arrived, and (later) Thursday invoice.
          </s-paragraph>
        </s-stack>
      ),
    },
    {
      id: "templates",
      title: "How to find templates in Klaviyo",
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
      title: "Test checklist",
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
            If automatic send fails, use Status emails → Send pending emails
            now
          </s-list-item>
        </s-ordered-list>
      ),
    },
    {
      id: "tabs",
      title: "App tabs",
      tone: "info",
      content: (
        <s-unordered-list>
          <s-list-item>
            <s-text type="strong">Preorders</s-text> — status buttons (Piece
            Made → Leaving → Arrived)
          </s-list-item>
          <s-list-item>
            <s-text type="strong">Status emails</s-text> — Klaviyo connection +
            manual send / preview
          </s-list-item>
          <s-list-item>
            <s-text type="strong">Thursday invoice</s-text> — combined shipping
            draft + email
          </s-list-item>
          <s-list-item>
            <s-text type="strong">After shipping paid</s-text> — alert when a
            new item is bought after shipping paid
          </s-list-item>
          <s-list-item>
            <s-text type="strong">Friday reset</s-text> — backup for unpaid
            Thursday invoices
          </s-list-item>
        </s-unordered-list>
      ),
    },
    {
      id: "architecture",
      title: "Automation architecture",
      tone: "info",
      content: (
        <s-unordered-list>
          <s-list-item>
            Status emails: Shopify{" "}
            <s-text type="strong">orders/updated</s-text> webhook (primary);
            Status emails tab as backfill
          </s-list-item>
          <s-list-item>
            Thursday invoices: Heroku Scheduler →{" "}
            <s-text type="strong">/api/cron/thursday</s-text>
          </s-list-item>
          <s-list-item>
            Friday unpaid tag flip: Shopify Flow (scheduled Friday midnight
            CST)
          </s-list-item>
          <s-list-item>
            Friday draft void: same orders/updated webhook when tag{" "}
            <s-text type="strong">pushed-to-next-weekend</s-text> appears
          </s-list-item>
        </s-unordered-list>
      ),
    },
    {
      id: "env",
      title: "Environment variables",
      tone: "caution",
      content: (
        <s-unordered-list>
          <s-list-item>
            <s-text type="strong">KLAVIYO_API_KEY</s-text> — Rangeelaa private
            key (events:write)
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
      title: "Common problems",
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
            <s-text type="strong">Klaviyo 404 on messages/send</s-text> — fixed
            in app; must use Create Event + Flows
          </s-list-item>
        </s-unordered-list>
      ),
    },
  ];

  return (
    <s-page heading="Documentation" inlineSize="large">
      <s-section heading="Guides" padding="base">
        <s-banner heading="Setup guide" tone="info">
          <s-paragraph>
            Open a section below to read setup steps. Only one section stays
            open at a time. Colored badges use Polaris tones (info, success,
            caution, warning).
          </s-paragraph>
        </s-banner>
        <DocAccordion items={items} />
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
