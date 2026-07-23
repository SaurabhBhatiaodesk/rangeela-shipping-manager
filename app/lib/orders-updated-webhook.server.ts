import { TAGS, hasTag, normalizeTags } from "./tags";
import { sendStatusEmailIfNeeded } from "./send-status-email.server";
import { graphqlJson, type AdminGraphql } from "./cycle-shared.server";

const META_NAMESPACE = "rangeela";
const META_DRAFT_KEY = "thursday_draft_id";

const STATUS_EMAIL_JOBS = [
  {
    statusTag: TAGS.PIECE_MADE,
    sentTag: TAGS.PIECE_MADE_EMAIL_SENT,
  },
  {
    statusTag: TAGS.LEAVING_FOR_CANADA,
    sentTag: TAGS.LEAVING_EMAIL_SENT,
  },
  {
    statusTag: TAGS.ARRIVED_IN_CANADA,
    sentTag: TAGS.ARRIVED_EMAIL_SENT,
  },
] as const;

/**
 * Task 1: for each status tag present without email-sent, send Klaviyo once.
 */
export async function processStatusEmailsFromOrderUpdate(
  admin: AdminGraphql,
  options: {
    orderGid: string;
    email: string | null;
    tags: string[];
  },
): Promise<void> {
  const { orderGid, email, tags } = options;

  for (const job of STATUS_EMAIL_JOBS) {
    const result = await sendStatusEmailIfNeeded(admin, {
      orderId: orderGid,
      email,
      tags,
      statusTag: job.statusTag,
      sentTag: job.sentTag,
    });
    if (!result.ok) {
      console.error(
        `[orders/updated] status email failed for ${orderGid} ${job.statusTag}:`,
        result.error,
      );
    } else if (!result.skipped) {
      console.log(
        `[orders/updated] sent ${job.statusTag} email for ${orderGid}`,
      );
      // Avoid re-sending other jobs with stale tags list in same request
      tags.push(job.sentTag);
    }
  }
}

/**
 * Task 4b: when pushed-to-next-weekend is present, void linked Thursday draft.
 */
export async function voidThursdayDraftIfPushed(
  admin: AdminGraphql,
  orderGid: string,
  tags: string[],
): Promise<void> {
  if (!hasTag(tags, TAGS.PUSHED_TO_NEXT_WEEKEND)) {
    return;
  }

  const json = await graphqlJson(
    admin,
    `#graphql
      query OrderThursdayDraft($id: ID!) {
        order(id: $id) {
          id
          metafield(namespace: "${META_NAMESPACE}", key: "${META_DRAFT_KEY}") {
            id
            value
          }
        }
      }`,
    { id: orderGid },
  );

  const order = json.data?.order;
  const draftId = order?.metafield?.value as string | undefined;
  if (!draftId) {
    console.log(
      `[orders/updated] pushed tag on ${orderGid} but no thursday_draft_id metafield`,
    );
    return;
  }

  const del = await graphqlJson(
    admin,
    `#graphql
      mutation WebhookDeleteThursdayDraft($input: DraftOrderDeleteInput!) {
        draftOrderDelete(input: $input) {
          deletedId
          userErrors { message }
        }
      }`,
    { input: { id: draftId } },
  );

  const userErrors = del.data?.draftOrderDelete?.userErrors ?? [];
  if (userErrors.length) {
    console.error(
      `[orders/updated] draftOrderDelete errors for ${orderGid}:`,
      userErrors,
    );
  } else {
    console.log(
      `[orders/updated] deleted draft ${draftId} for order ${orderGid}`,
    );
  }

  if (order?.metafield?.id) {
    await graphqlJson(
      admin,
      `#graphql
        mutation WebhookClearThursdayDraftMetafield($metafields: [MetafieldIdentifierInput!]!) {
          metafieldsDelete(metafields: $metafields) {
            userErrors { message }
          }
        }`,
      {
        metafields: [
          {
            ownerId: orderGid,
            namespace: META_NAMESPACE,
            key: META_DRAFT_KEY,
          },
        ],
      },
    );
  }
}

export function orderGidFromWebhookPayload(payload: {
  admin_graphql_api_id?: string;
  id?: number | string;
}): string {
  if (payload.admin_graphql_api_id) {
    return payload.admin_graphql_api_id;
  }
  return `gid://shopify/Order/${payload.id}`;
}

export function parseWebhookOrderTags(payload: {
  tags?: string | string[];
}): string[] {
  return normalizeTags(payload.tags);
}
