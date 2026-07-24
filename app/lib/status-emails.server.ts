import { TAGS, hasTag, normalizeTags } from "./tags";
import { sendStatusEmailIfNeeded } from "./send-status-email.server";
import {
  type AdminGraphql,
  graphqlJson,
} from "./cycle-shared.server";
import { KLAVIYO_TEMPLATES } from "./tags";

/**
 * Client Task 1 — Heroku poller (NOT Shopify Flow).
 * Sidekick/buttons add status tags → this job sends Klaviyo + email-sent tags.
 */

type StatusEmailJob = {
  statusTag:
    | typeof TAGS.PIECE_MADE
    | typeof TAGS.LEAVING_FOR_CANADA
    | typeof TAGS.ARRIVED_IN_CANADA;
  sentTag: string;
  label: string;
};

const JOBS: StatusEmailJob[] = [
  {
    statusTag: TAGS.PIECE_MADE,
    sentTag: TAGS.PIECE_MADE_EMAIL_SENT,
    label: "Piece Made",
  },
  {
    statusTag: TAGS.LEAVING_FOR_CANADA,
    sentTag: TAGS.LEAVING_EMAIL_SENT,
    label: "Leaving for Canada",
  },
  {
    statusTag: TAGS.ARRIVED_IN_CANADA,
    sentTag: TAGS.ARRIVED_EMAIL_SENT,
    label: "Arrived in Canada",
  },
];

export type StatusEmailRow = {
  orderName: string;
  orderId: string;
  email: string | null;
  job: string;
  result: "sent" | "skipped" | "error";
  detail?: string;
};

export type StatusEmailPollResult = {
  ok: boolean;
  dryRun: boolean;
  checked: number;
  sent: number;
  skipped: number;
  errors: number;
  rows: StatusEmailRow[];
  message: string;
};

async function fetchOrdersNeedingEmail(
  admin: AdminGraphql,
  statusTag: string,
  sentTag: string,
) {
  const query = `tag:${statusTag} AND -tag:${sentTag}`;
  const json = await graphqlJson(
    admin,
    `#graphql
      query StatusEmailOrders($first: Int!, $query: String!) {
        orders(first: $first, query: $query, sortKey: UPDATED_AT, reverse: true) {
          edges {
            node {
              id
              name
              email
              tags
            }
          }
        }
      }`,
    { first: 50, query },
  );

  return (json.data?.orders?.edges ?? []).map(
    (edge: {
      node: {
        id: string;
        name: string;
        email: string | null;
        tags: string[] | string;
      };
    }) => ({
      id: edge.node.id,
      name: edge.node.name,
      email: edge.node.email,
      tags: normalizeTags(edge.node.tags),
    }),
  );
}

export async function runStatusEmailPoller(
  admin: AdminGraphql,
  options: { dryRun?: boolean } = {},
): Promise<StatusEmailPollResult> {
  const dryRun = Boolean(options.dryRun);
  const rows: StatusEmailRow[] = [];
  let sent = 0;
  let skipped = 0;
  let errors = 0;
  let checked = 0;

  for (const job of JOBS) {
    const orders = await fetchOrdersNeedingEmail(
      admin,
      job.statusTag,
      job.sentTag,
    );

    for (const order of orders) {
      checked += 1;

      const statusOk = hasTag(order.tags, job.statusTag);
      const alreadySent = hasTag(order.tags, job.sentTag);

      if (!statusOk || alreadySent || !order.email) {
        skipped += 1;
        rows.push({
          orderName: order.name,
          orderId: order.id,
          email: order.email,
          job: job.label,
          result: "skipped",
          detail: !statusOk
            ? "status tag missing"
            : alreadySent
              ? "email-sent already present"
              : "no customer email",
        });
        continue;
      }

      if (dryRun) {
        skipped += 1;
        rows.push({
          orderName: order.name,
          orderId: order.id,
          email: order.email,
          job: job.label,
          result: "skipped",
          detail: `preview only — would send template ${KLAVIYO_TEMPLATES[job.statusTag].templateId}`,
        });
        continue;
      }

      const result = await sendStatusEmailIfNeeded(admin, {
        orderId: order.id,
        email: order.email,
        tags: order.tags,
        statusTag: job.statusTag,
        sentTag: job.sentTag,
      });

      if (!result.ok) {
        errors += 1;
        rows.push({
          orderName: order.name,
          orderId: order.id,
          email: order.email,
          job: job.label,
          result: "error",
          detail: result.error,
        });
        continue;
      }

      if (result.skipped) {
        skipped += 1;
        rows.push({
          orderName: order.name,
          orderId: order.id,
          email: order.email,
          job: job.label,
          result: "skipped",
        });
        continue;
      }

      sent += 1;
      rows.push({
        orderName: order.name,
        orderId: order.id,
        email: order.email,
        job: job.label,
        result: "sent",
        detail: `template ${KLAVIYO_TEMPLATES[job.statusTag].templateId}`,
      });
    }
  }

  return {
    ok: errors === 0,
    dryRun,
    checked,
    sent,
    skipped,
    errors,
    rows,
    message: dryRun
      ? `Preview: checked ${checked} order(s) — no emails were sent`
      : errors > 0
        ? `Status emails: sent ${sent}, skipped ${skipped}, failed ${errors}. ${
            rows
              .filter((r) => r.result === "error")
              .map((r) => `${r.orderName} (${r.job}): ${r.detail}`)
              .slice(0, 2)
              .join(" | ")
          }`
        : `Status emails: sent ${sent}, skipped ${skipped}`,
  };
}
