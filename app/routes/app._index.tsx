import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { PreorderStatusButtons } from "../components/PreorderStatusButtons";
import { ShippingPaidAlert } from "../components/ShippingPaidAlert";
import {
  applyStatusAction,
  fetchAwaitingReadinessOrders,
  fetchShippingPaidAlerts,
} from "../lib/orders.server";
import { previewThursdayPools, runThursdayCycle } from "../lib/thursday-cycle.server";
import { runFridayReset } from "../lib/friday-reset.server";
import { runStatusEmailPoller } from "../lib/status-emails.server";
import type { StatusAction } from "../lib/tags";
import { authenticate } from "../shopify.server";

type TabId =
  | "preorders"
  | "emails"
  | "thursday"
  | "alerts"
  | "friday";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const tab = (url.searchParams.get("tab") || "preorders") as TabId;

  const base = {
    klaviyoConfigured: Boolean(process.env.KLAVIYO_API_KEY),
    thursdayTemplateConfigured: Boolean(
      process.env.KLAVIYO_THURSDAY_TEMPLATE_ID,
    ),
    cronConfigured: Boolean(process.env.CRON_SECRET && process.env.CRON_SHOP),
    loadError: null as string | null,
  };

  try {
    if (tab === "alerts") {
      const alerts = await fetchShippingPaidAlerts(admin);
      return { ...base, tab, preorders: [], alerts, thursdayPreview: null };
    }

    if (tab === "thursday") {
      const thursdayPreview = await previewThursdayPools(admin);
      return {
        ...base,
        tab,
        preorders: [],
        alerts: [],
        thursdayPreview,
      };
    }

    if (tab === "friday" || tab === "emails") {
      return {
        ...base,
        tab,
        preorders: [],
        alerts: [],
        thursdayPreview: null,
      };
    }

    const preorders = await fetchAwaitingReadinessOrders(admin);
    return {
      ...base,
      tab,
      preorders,
      alerts: [],
      thursdayPreview: null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load data";
    return {
      ...base,
      tab,
      preorders: [],
      alerts: [],
      thursdayPreview: null,
      loadError: message,
    };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "status");

  if (intent === "thursday_run") {
    const dryRun = formData.get("dryRun") === "1";
    return runThursdayCycle(admin, { dryRun });
  }

  if (intent === "friday_run") {
    const dryRun = formData.get("dryRun") === "1";
    return runFridayReset(admin, { dryRun });
  }

  if (intent === "status_emails_run") {
    const dryRun = formData.get("dryRun") === "1";
    return runStatusEmailPoller(admin, { dryRun });
  }

  const orderId = String(formData.get("orderId") || "");
  const actionName = String(formData.get("actionName") || "") as StatusAction;

  if (!orderId || !actionName) {
    return { ok: false as const, error: "Missing orderId or action" };
  }

  return applyStatusAction(admin, orderId, actionName);
};

export default function ShippingManagerIndex() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const tab = (searchParams.get("tab") || data.tab || "preorders") as TabId;

  useEffect(() => {
    if (fetcher.state !== "idle") return;
    setBusyAction(null);

    if (!fetcher.data) return;

    if ("message" in fetcher.data && fetcher.data.message) {
      const isError = "ok" in fetcher.data && fetcher.data.ok === false;
      shopify.toast.show(fetcher.data.message, { isError });
      return;
    }

    if ("ok" in fetcher.data && fetcher.data.ok) {
      shopify.toast.show(
        "message" in fetcher.data && fetcher.data.message
          ? String(fetcher.data.message)
          : "Done",
      );
    } else if ("error" in fetcher.data && fetcher.data.error) {
      shopify.toast.show(String(fetcher.data.error), { isError: true });
    }
  }, [fetcher.state, fetcher.data, shopify]);

  const setTab = (next: TabId) => {
    const params = new URLSearchParams(searchParams);
    if (next === "preorders") params.delete("tab");
    else params.set("tab", next);
    setSearchParams(params);
  };

  const runAction = (orderId: string, actionName: StatusAction) => {
    setBusyAction(`${orderId}:${actionName}`);
    fetcher.submit({ intent: "status", orderId, actionName }, { method: "POST" });
  };

  const runCycle = (
    intent: "thursday_run" | "friday_run" | "status_emails_run",
    dryRun: boolean,
  ) => {
    setBusyAction(intent);
    fetcher.submit(
      { intent, dryRun: dryRun ? "1" : "0" },
      { method: "POST" },
    );
  };

  const cycleBusy = fetcher.state !== "idle";

  return (
    <s-page heading="Rangeela Shipping Manager">
      {data.loadError && (
        <s-banner heading="Could not load data" tone="critical">
          <s-paragraph>{data.loadError}</s-paragraph>
          <s-paragraph>
            Restart <s-text type="strong">shopify app dev</s-text> and approve
            order + draft order scopes if needed.
          </s-paragraph>
        </s-banner>
      )}

      <s-section heading="All options">
        <s-stack direction="inline" gap="small-200">
          <s-button
            variant={tab === "preorders" ? "primary" : "secondary"}
            onClick={() => setTab("preorders")}
          >
            1. Preorders — Awaiting Readiness
          </s-button>
          <s-button
            variant={tab === "emails" ? "primary" : "secondary"}
            onClick={() => setTab("emails")}
          >
            2. Status emails (Klaviyo)
          </s-button>
          <s-button
            variant={tab === "thursday" ? "primary" : "secondary"}
            onClick={() => setTab("thursday")}
          >
            3. Thursday invoice
          </s-button>
          <s-button
            variant={tab === "alerts" ? "primary" : "secondary"}
            onClick={() => setTab("alerts")}
          >
            4. After shipping paid
          </s-button>
          <s-button
            variant={tab === "friday" ? "primary" : "secondary"}
            onClick={() => setTab("friday")}
          >
            5. Friday reset
          </s-button>
        </s-stack>
      </s-section>

      {tab === "preorders" && (
        <s-section heading="Preorders — Awaiting Readiness">
          <s-paragraph>
            Sequential status buttons: Piece Made → Leaving for Canada → Arrived
            in Canada. Skirt deposits use Mark Deposit Fulfilled.
          </s-paragraph>
          {data.preorders.length === 0 ? (
            <s-paragraph>
              No orders awaiting readiness. Create a test order in the store to
              see it here.
            </s-paragraph>
          ) : (
            <s-table>
              <s-table-header-row>
                <s-table-header listSlot="primary">Order</s-table-header>
                <s-table-header listSlot="secondary">Customer</s-table-header>
                <s-table-header listSlot="labeled">Type</s-table-header>
                <s-table-header listSlot="inline">Actions</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {data.preorders.map((order) => (
                  <s-table-row key={order.id}>
                    <s-table-cell>
                      <s-link
                        href={`shopify://admin/orders/${order.id.split("/").pop()}`}
                      >
                        {order.name}
                      </s-link>
                    </s-table-cell>
                    <s-table-cell>
                      {order.customerName || order.email || "—"}
                    </s-table-cell>
                    <s-table-cell>
                      {order.isSkirtDeposit ? (
                        <s-badge tone="info">Skirt deposit</s-badge>
                      ) : (
                        <s-badge>Preorder</s-badge>
                      )}
                    </s-table-cell>
                    <s-table-cell>
                      <PreorderStatusButtons
                        order={order}
                        busyAction={busyAction}
                        onAction={runAction}
                      />
                    </s-table-cell>
                  </s-table-row>
                ))}
              </s-table-body>
            </s-table>
          )}
        </s-section>
      )}

      {tab === "emails" && (
        <s-section heading="Task 1 — Status emails (orders/updated webhook)">
          <s-paragraph>
            Primary path: Sidekick/Admin/app adds a status tag → Shopify fires{" "}
            <s-text type="strong">orders/updated</s-text> → app sends Klaviyo
            once → adds <s-text type="strong">*-email-sent</s-text>.
          </s-paragraph>
          <s-unordered-list>
            <s-list-item>
              Piece Made → WMcvs7 → piece-made-email-sent
            </s-list-item>
            <s-list-item>
              Leaving for Canada → TB2w7d → leaving-email-sent
            </s-list-item>
            <s-list-item>
              Arrived in Canada → XmXMMJ → arrived-email-sent
            </s-list-item>
          </s-unordered-list>

          <s-banner
            heading={
              data.klaviyoConfigured
                ? "Klaviyo API key configured"
                : "Set KLAVIYO_API_KEY first"
            }
            tone={data.klaviyoConfigured ? "success" : "warning"}
          >
            <s-paragraph>
              Test: in Shopify Admin, add tag{" "}
              <s-text type="strong">piece-made-notified</s-text> to an order,
              then confirm the email and{" "}
              <s-text type="strong">piece-made-email-sent</s-text> tag.
            </s-paragraph>
          </s-banner>

          <s-paragraph>
            Optional backfill (if a webhook was missed):
          </s-paragraph>
          <s-stack direction="inline" gap="small-200">
            <s-button
              variant="secondary"
              disabled={cycleBusy}
              onClick={() => runCycle("status_emails_run", true)}
            >
              Backfill dry run
            </s-button>
            <s-button
              variant="secondary"
              disabled={cycleBusy}
              {...(busyAction === "status_emails_run" ? { loading: true } : {})}
              onClick={() => runCycle("status_emails_run", false)}
            >
              Run email backfill now
            </s-button>
          </s-stack>
        </s-section>
      )}

      {tab === "thursday" && (
        <s-section heading="3. Thursday combined shipping invoice">
          <s-paragraph>
            Groups eligible Pool 1 (preorder ready) + Pool 2 (RTW canada/dispatch)
            by customer email into one draft invoice. Excludes India / Saskatoon.
          </s-paragraph>
          <s-stack direction="inline" gap="small-200">
            <s-button
              variant="secondary"
              disabled={cycleBusy}
              onClick={() => runCycle("thursday_run", true)}
            >
              Dry run preview
            </s-button>
            <s-button
              variant="primary"
              disabled={cycleBusy}
              {...(busyAction === "thursday_run" ? { loading: true } : {})}
              onClick={() => runCycle("thursday_run", false)}
            >
              Run Thursday cycle now
            </s-button>
          </s-stack>

          {!data.thursdayTemplateConfigured && (
            <s-banner heading="Thursday Klaviyo template ID missing" tone="warning">
              <s-paragraph>
                Ask the client for the Thursday shipping invoice Klaviyo template
                ID, then set{" "}
                <s-text type="strong">KLAVIYO_THURSDAY_TEMPLATE_ID</s-text>. Dry
                run and draft orders still work without it; emails send once the
                ID is set.
              </s-paragraph>
            </s-banner>
          )}

          {data.thursdayPreview && (
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-paragraph>
                Preview: {data.thursdayPreview.customersProcessed} customer(s)
              </s-paragraph>
              {data.thursdayPreview.results.length === 0 ? (
                <s-paragraph>No qualifying orders this cycle.</s-paragraph>
              ) : (
                <s-table>
                  <s-table-header-row>
                    <s-table-header listSlot="primary">Email</s-table-header>
                    <s-table-header listSlot="secondary">Orders</s-table-header>
                    <s-table-header listSlot="labeled">Items</s-table-header>
                    <s-table-header listSlot="inline">Shipping</s-table-header>
                  </s-table-header-row>
                  <s-table-body>
                    {data.thursdayPreview.results.map((row) => (
                      <s-table-row key={row.email}>
                        <s-table-cell>{row.email}</s-table-cell>
                        <s-table-cell>{row.orderNames.join(", ")}</s-table-cell>
                        <s-table-cell>{row.itemCount}</s-table-cell>
                        <s-table-cell>{row.shippingAmount}</s-table-cell>
                      </s-table-row>
                    ))}
                  </s-table-body>
                </s-table>
              )}
            </s-box>
          )}

          <s-paragraph>
            Cron: <s-text type="strong">GET/POST /api/cron/thursday</s-text> with
            Bearer CRON_SECRET (Heroku Scheduler every Thursday).
          </s-paragraph>
        </s-section>
      )}

      {tab === "alerts" && (
        <s-section heading="4. New item after shipping paid">
          <s-paragraph>
            Ship now (manual) or Hold for next Thursday (
            <s-text type="strong">hold-for-next-cycle</s-text>).
          </s-paragraph>
          {data.alerts.length === 0 ? (
            <s-paragraph>No alerts right now.</s-paragraph>
          ) : (
            <s-stack direction="block" gap="base">
              {data.alerts.map((order) => (
                <ShippingPaidAlert
                  key={order.id}
                  order={order}
                  busy={busyAction === `${order.id}:hold_for_next_cycle`}
                  onHold={(orderId) =>
                    runAction(orderId, "hold_for_next_cycle")
                  }
                />
              ))}
            </s-stack>
          )}
        </s-section>
      )}

      {tab === "friday" && (
        <s-section heading="5. Friday midnight reset">
          <s-paragraph>
            Primary path: <s-text type="strong">Shopify Flow</s-text> (Friday
            midnight CST) removes thursday-email-sent and adds
            pushed-to-next-weekend. Then{" "}
            <s-text type="strong">orders/updated</s-text> voids the linked draft
            invoice via metafield.
          </s-paragraph>
          <s-paragraph>
            Buttons below are a manual backup if Flow did not run.
          </s-paragraph>
          <s-stack direction="inline" gap="small-200">
            <s-button
              variant="secondary"
              disabled={cycleBusy}
              onClick={() => runCycle("friday_run", true)}
            >
              Backup dry run
            </s-button>
            <s-button
              variant="primary"
              tone="critical"
              disabled={cycleBusy}
              {...(busyAction === "friday_run" ? { loading: true } : {})}
              onClick={() => runCycle("friday_run", false)}
            >
              Run Friday backup now
            </s-button>
          </s-stack>
          <s-paragraph>
            Flow setup steps: see <s-text type="strong">docs/operations.md</s-text>.
          </s-paragraph>
          {!data.cronConfigured && (
            <s-banner heading="Cron env incomplete" tone="info">
              <s-paragraph>
                Set <s-text type="strong">CRON_SECRET</s-text> and{" "}
                <s-text type="strong">CRON_SHOP</s-text> for Thursday scheduler
                and backup routes.
              </s-paragraph>
            </s-banner>
          )}
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
