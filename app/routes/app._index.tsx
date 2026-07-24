import { useEffect, useState, startTransition } from "react";
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
  import {
    previewThursdayPools,
    runThursdayCycle,
  } from "../lib/thursday-cycle.server";
  import { runFridayReset } from "../lib/friday-reset.server";
  import { runStatusEmailPoller } from "../lib/status-emails.server";
  import type { StatusAction } from "../lib/tags";
  import { hasTag, TAGS } from "../lib/tags";
  import { authenticate } from "../shopify.server";

  type TabId = "preorders" | "emails" | "thursday" | "alerts" | "friday";

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

  function TabButton({
    active,
    number,
    label,
    onClick,
  }: {
    active: boolean;
    number: string;
    label: string;
    onClick: () => void;
  }) {
    return (
      <s-button
        variant={active ? "primary" : "secondary"}
        onClick={onClick}
        accessibilityLabel={`${number}. ${label}${active ? " (selected)" : ""}`}
      >
        {number}. {label}
      </s-button>
    );
  }

  export default function ShippingManagerIndex() {
    const data = useLoaderData<typeof loader>();
    const fetcher = useFetcher<typeof action>();
    const shopify = useAppBridge();
    const [searchParams, setSearchParams] = useSearchParams();
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [lastEmailRun, setLastEmailRun] = useState<{
      rows?: Array<{
        orderName: string;
        job: string;
        result: string;
        detail?: string;
      }>;
    } | null>(null);

    const pageSize = 10;
    const currentPage = Math.max(
      1,
      Number(searchParams.get("page") || "1"),
    );
    const totalPages = Math.max(
      1,
      Math.ceil(data.preorders.length / pageSize),
    );
    const page = Math.min(currentPage, totalPages);

    const pagedPreorders = data.preorders.slice(
      (page - 1) * pageSize,
      page * pageSize,
    );

    const setPage = (nextPage: number) => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams);
        if (nextPage <= 1) {
          params.delete("page");
        } else {
          params.set("page", String(nextPage));
        }
        setSearchParams(params);
      });
    };

    const tab = (searchParams.get("tab") || data.tab || "preorders") as TabId;
    const cycleBusy = fetcher.state !== "idle";

    useEffect(() => {
      if (fetcher.state !== "idle") return;
      setBusyAction(null);

      if (!fetcher.data) return;

      if ("rows" in fetcher.data && Array.isArray(fetcher.data.rows)) {
        setLastEmailRun({ rows: fetcher.data.rows });
      }

      if ("message" in fetcher.data && fetcher.data.message) {
        const isError = "ok" in fetcher.data && fetcher.data.ok === false;
        shopify.toast.show(String(fetcher.data.message).slice(0, 200), {
          isError,
        });
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
      startTransition(() => {
        const params = new URLSearchParams(searchParams);
        if (next === "preorders") params.delete("tab");
        else params.set("tab", next);
        setSearchParams(params);
      });
    };

    const runAction = (orderId: string, actionName: StatusAction) => {
      setBusyAction(`${orderId}:${actionName}`);
      fetcher.submit(
        { intent: "status", orderId, actionName },
        { method: "POST" },
      );
    };

    const runCycle = (
      intent: "thursday_run" | "friday_run" | "status_emails_run",
      dryRun: boolean,
    ) => {
      setBusyAction(`${intent}:${dryRun ? "preview" : "run"}`);
      fetcher.submit(
        { intent, dryRun: dryRun ? "1" : "0" },
        { method: "POST" },
      );
    };

    const isBusy = (key: string) => busyAction === key && cycleBusy;

    return (
      <s-page heading="Rangeela Shipping Manager" inlineSize="large">
        {data.loadError && (
          <s-banner heading="Could not load data" tone="critical">
            <s-paragraph>{data.loadError}</s-paragraph>
            <s-paragraph>
              Restart the app with <s-text type="strong">shopify app dev</s-text>{" "}
              and approve order scopes if prompted.
            </s-paragraph>
          </s-banner>
        )}

        <s-banner heading="Workflow steps" tone="success">
          <s-paragraph>
            Choose a step below. The selected step uses the Polaris primary
            button color.
          </s-paragraph>
        </s-banner>

        <s-section heading="Menu" padding="base">
          <s-stack direction="inline" gap="small" alignItems="center">
            <TabButton
              active={tab === "preorders"}
              number="01"
              label="Preorders — Awaiting Readiness"
              onClick={() => setTab("preorders")}
            />
            <TabButton
              active={tab === "emails"}
              number="02"
              label="Status emails (Klaviyo)"
              onClick={() => setTab("emails")}
            />
            <TabButton
              active={tab === "thursday"}
              number="03"
              label="Thursday invoice"
              onClick={() => setTab("thursday")}
            />
            <TabButton
              active={tab === "alerts"}
              number="04"
              label="After shipping paid"
              onClick={() => setTab("alerts")}
            />
            <TabButton
              active={tab === "friday"}
              number="05"
              label="Friday reset"
              onClick={() => setTab("friday")}
            />
          </s-stack>
        </s-section>

        {tab === "preorders" && (
          <s-section heading="Preorders — Awaiting Readiness" padding="base">
            <s-banner heading="Status progress" tone="info">
              <s-paragraph>
                Update each preorder in order: Piece Made → Leaving for Canada →
                Arrived in Canada. Completed steps show as green success badges.
                Skirt deposits use Mark Deposit Fulfilled.
              </s-paragraph>
            </s-banner>
            {data.preorders.length === 0 ? (
              <s-banner heading="No preorders yet" tone="warning">
                <s-paragraph>
                  Create a test order in the store to see status actions here.
                </s-paragraph>
              </s-banner>
            ) : (
              <>
                <s-table>
                  <s-table-header-row>
                    <s-table-header listSlot="primary">Order</s-table-header>
                    <s-table-header listSlot="secondary">Customer</s-table-header>
                    <s-table-header listSlot="labeled">Type</s-table-header>
                    <s-table-header listSlot="inline">Actions</s-table-header>
                  </s-table-header-row>
                  <s-table-body>
                    {pagedPreorders.map((order) => (
                      <s-table-row key={order.id}>
                        <s-table-cell>
                          <s-link
                            href={`shopify://admin/orders/${order.id
                              .split("/")
                              .pop()}`}
                          >
                            {order.name}
                          </s-link>
                        </s-table-cell>
                        <s-table-cell>
                          {order.customerName || order.email || "—"}
                        </s-table-cell>
                        <s-table-cell>
                          {order.isSkirtDeposit ? (
                            hasTag(order.tags, TAGS.DEPOSIT_FULFILLED) ? (
                              <s-badge
                                tone="success"
                                color="strong"
                                icon="check-circle"
                              >
                                Skirt deposit
                              </s-badge>
                            ) : (
                              <s-badge tone="info" color="strong">
                                Skirt deposit
                              </s-badge>
                            )
                          ) : hasTag(order.tags, TAGS.ARRIVED_IN_CANADA) ||
                            hasTag(order.tags, TAGS.READY_TO_SHIP) ? (
                            <s-badge
                              tone="success"
                              color="strong"
                              icon="check-circle"
                            >
                              Preorder
                            </s-badge>
                          ) : hasTag(order.tags, TAGS.LEAVING_FOR_CANADA) ? (
                            <s-badge tone="caution" color="strong">
                              Preorder
                            </s-badge>
                          ) : hasTag(order.tags, TAGS.PIECE_MADE) ? (
                            <s-badge tone="info" color="strong">
                              Preorder
                            </s-badge>
                          ) : (
                            <s-badge tone="neutral">Preorder</s-badge>
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

                {totalPages > 1 && (
                  <s-stack direction="inline" gap="base" alignItems="center">
                    <s-button
                      variant="secondary"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Previous
                    </s-button>
                    <s-paragraph>
                      Page {page} of {totalPages}
                    </s-paragraph>
                    <s-button
                      variant="secondary"
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                    </s-button>
                  </s-stack>
                )}
              </>
            )}
          </s-section>
        )}

        {tab === "emails" && (
          <s-section heading="Status emails" padding="base">
            <s-stack direction="block" gap="large">
              <s-stack direction="block" gap="base">
                <s-paragraph>
                  When a status tag is added, the app creates a Klaviyo event. A
                  live Klaviyo Flow for that metric sends the email, then the
                  app adds an email-sent tag so it is not sent again.
                </s-paragraph>
                <s-unordered-list>
                  <s-list-item>
                    Piece Made → metric "Rangeela Piece Made" → template WMcvs7
                    → tag piece-made-email-sent
                  </s-list-item>
                  <s-list-item>
                    Leaving for Canada → metric "Rangeela Leaving for Canada" →
                    template TB2w7d → tag leaving-email-sent
                  </s-list-item>
                  <s-list-item>
                    Arrived in Canada → metric "Rangeela Arrived in Canada" →
                    template XmXMMJ → tag arrived-email-sent
                  </s-list-item>
                </s-unordered-list>
              </s-stack>

              <s-banner
                heading={
                  data.klaviyoConfigured
                    ? "Klaviyo is connected"
                    : "Klaviyo API key is missing"
                }
                tone={data.klaviyoConfigured ? "success" : "warning"}
              >
                <s-paragraph>
                  To test: in Shopify Admin, add the tag{" "}
                  <s-text type="strong">piece-made-notified</s-text> to an order.
                  Confirm the customer receives the email and the order gets{" "}
                  <s-text type="strong">piece-made-email-sent</s-text>.
                </s-paragraph>
              </s-banner>

              <s-stack direction="block" gap="base">
                <s-paragraph>
                  If an email did not send automatically, use these buttons:
                </s-paragraph>
                <s-stack direction="inline" gap="base">
                  <s-button
                    variant={
                      isBusy("status_emails_run:preview")
                        ? "primary"
                        : "secondary"
                    }
                    disabled={cycleBusy}
                    {...(isBusy("status_emails_run:preview")
                      ? { loading: true }
                      : {})}
                    onClick={() => runCycle("status_emails_run", true)}
                  >
                    Preview only (no emails sent)
                  </s-button>
                  <s-button
                    variant="primary"
                    disabled={cycleBusy}
                    {...(isBusy("status_emails_run:run")
                      ? { loading: true }
                      : {})}
                    onClick={() => runCycle("status_emails_run", false)}
                  >
                    Send pending emails now
                  </s-button>
                </s-stack>

                {lastEmailRun?.rows && lastEmailRun.rows.length > 0 && (
                  <s-box padding="base" borderWidth="base" borderRadius="base">
                    <s-stack direction="block" gap="base">
                      <s-heading>Last check result</s-heading>
                      <s-unordered-list>
                        {lastEmailRun.rows.map((row, i) => {
                          const label =
                            row.result === "sent"
                              ? "Email sent"
                              : row.result === "error"
                                ? "Failed"
                                : row.detail?.includes("preview only")
                                  ? "Preview only (not sent)"
                                  : "Skipped";
                          const extra =
                            row.result === "error"
                              ? row.detail
                              : row.detail?.includes("would send template")
                                ? row.detail.replace("preview only — ", "")
                                : undefined;
                          return (
                            <s-list-item
                              key={`${row.orderName}-${row.job}-${i}`}
                            >
                              {row.orderName} — {row.job}: {label}
                              {extra ? ` — ${extra}` : ""}
                            </s-list-item>
                          );
                        })}
                      </s-unordered-list>
                    </s-stack>
                  </s-box>
                )}
              </s-stack>
            </s-stack>
          </s-section>
        )}

        {tab === "thursday" && (
          <s-section heading="Thursday shipping invoice" padding="base">
            <s-stack direction="block" gap="base">
              <s-paragraph>
                Combines eligible preorder and ready-to-wear orders for the same
                customer into one draft shipping invoice. Excludes Saskatoon and
                India-only / mixed India orders.
              </s-paragraph>

              <s-button-group gap="base" accessibilityLabel="Thursday cycle actions">
                <s-button
                  slot="secondary-actions"
                  variant={
                    isBusy("thursday_run:preview") ? "primary" : "secondary"
                  }
                  disabled={cycleBusy}
                  {...(isBusy("thursday_run:preview") ? { loading: true } : {})}
                  onClick={() => runCycle("thursday_run", true)}
                >
                  Preview only (no invoices created)
                </s-button>
                <s-button
                  slot="primary-action"
                  variant="primary"
                  disabled={cycleBusy}
                  {...(isBusy("thursday_run:run") ? { loading: true } : {})}
                  onClick={() => runCycle("thursday_run", false)}
                >
                  Run Thursday cycle now
                </s-button>
              </s-button-group>

              {!data.thursdayTemplateConfigured && (
                <s-banner
                  heading="Thursday email template ID is missing"
                  tone="warning"
                >
                  <s-paragraph>
                    Ask the client for the Thursday shipping invoice Klaviyo
                    template ID, then set{" "}
                    <s-text type="strong">KLAVIYO_THURSDAY_TEMPLATE_ID</s-text>.
                    Preview and draft orders still work; invoice emails send after
                    the ID is set.
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
            </s-stack>
          </s-section>
        )}

        {tab === "alerts" && (
          <s-section heading="New item after shipping paid" padding="base">
            <s-paragraph>
              Choose Ship now (handled manually) or Hold for next Thursday. Hold
              adds the tag <s-text type="strong">hold-for-next-cycle</s-text>.
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
          <s-section heading="Friday reset" padding="base">
            <s-paragraph>
              On Friday midnight (CST), Shopify Flow removes{" "}
              <s-text type="strong">thursday-email-sent</s-text> and adds{" "}
              <s-text type="strong">pushed-to-next-weekend</s-text>. The app then
              cancels the old unpaid draft invoice.
            </s-paragraph>
            <s-paragraph>
              Use the buttons below only as a manual backup if Flow did not run.
            </s-paragraph>
            <s-button-group gap="base" accessibilityLabel="Friday reset actions">
              <s-button
                slot="secondary-actions"
                variant={isBusy("friday_run:preview") ? "primary" : "secondary"}
                disabled={cycleBusy}
                {...(isBusy("friday_run:preview") ? { loading: true } : {})}
                onClick={() => runCycle("friday_run", true)}
              >
                Preview only (no changes)
              </s-button>
              <s-button
                slot="primary-action"
                variant="primary"
                tone="critical"
                disabled={cycleBusy}
                {...(isBusy("friday_run:run") ? { loading: true } : {})}
                onClick={() => runCycle("friday_run", false)}
              >
                Run Friday backup now
              </s-button>
            </s-button-group>
            {!data.cronConfigured && (
              <s-banner heading="Scheduler settings incomplete" tone="info">
                <s-paragraph>
                  Set <s-text type="strong">CRON_SECRET</s-text> and{" "}
                  <s-text type="strong">CRON_SHOP</s-text> for automated Thursday
                  runs.
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
