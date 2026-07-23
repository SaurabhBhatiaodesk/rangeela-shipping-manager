import { TAGS, hasTag, normalizeTags } from "./tags";
import {
  type AdminGraphql,
  graphqlJson,
} from "./cycle-shared.server";

const META_NAMESPACE = "rangeela";
const META_DRAFT_KEY = "thursday_draft_id";

export type FridayResetResult = {
  ok: boolean;
  dryRun: boolean;
  ordersProcessed: number;
  draftsDeleted: number;
  errors: string[];
  message: string;
};

/**
 * Friday backup reset (primary path = Shopify Flow tags + orders/updated void).
 *
 * Backup when Flow did not run:
 * - delete linked draft order
 * - remove thursday-email-sent
 * - add pushed-to-next-weekend
 * - clear thursday draft metafield
 *
 * Note: adding pushed-to-next-weekend also triggers orders/updated, which voids
 * the draft if metafield still present — safe if draft already deleted here.
 */
export async function runFridayReset(
  admin: AdminGraphql,
  options: { dryRun?: boolean } = {},
): Promise<FridayResetResult> {
  const dryRun = Boolean(options.dryRun);
  const errors: string[] = [];
  let ordersProcessed = 0;
  let draftsDeleted = 0;

  const json = await graphqlJson(
    admin,
    `#graphql
      query FridayUnpaidThursdayOrders($first: Int!, $query: String!) {
        orders(first: $first, query: $query) {
          edges {
            node {
              id
              name
              tags
              metafield(namespace: "${META_NAMESPACE}", key: "${META_DRAFT_KEY}") {
                id
                value
              }
            }
          }
        }
      }`,
    {
      first: 100,
      query: `tag:${TAGS.THURSDAY_EMAIL_SENT} AND -tag:${TAGS.SHIPPING_PAID}`,
    },
  );

  const edges = json.data?.orders?.edges ?? [];
  const deletedDrafts = new Set<string>();

  for (const edge of edges) {
    const order = edge.node as {
      id: string;
      name: string;
      tags: string[] | string;
      metafield: { id?: string; value?: string } | null;
    };

    const tags = normalizeTags(order.tags);
    if (!hasTag(tags, TAGS.THURSDAY_EMAIL_SENT)) continue;
    if (hasTag(tags, TAGS.SHIPPING_PAID)) continue;

    ordersProcessed += 1;
    const draftId = order.metafield?.value;

    if (dryRun) continue;

    try {
      if (draftId && !deletedDrafts.has(draftId)) {
        const del = await graphqlJson(
          admin,
          `#graphql
            mutation DeleteThursdayDraft($input: DraftOrderDeleteInput!) {
              draftOrderDelete(input: $input) {
                deletedId
                userErrors { message }
              }
            }`,
          { input: { id: draftId } },
        );
        const userErrors = del.data?.draftOrderDelete?.userErrors ?? [];
        if (userErrors.length) {
          // Draft may already be gone — continue tagging
          errors.push(
            `${order.name}: draft ${userErrors.map((e: { message: string }) => e.message).join(", ")}`,
          );
        } else {
          draftsDeleted += 1;
          deletedDrafts.add(draftId);
        }
      }

      await graphqlJson(
        admin,
        `#graphql
          mutation FridayRemoveThursdayTag($id: ID!, $tags: [String!]!) {
            tagsRemove(id: $id, tags: $tags) {
              userErrors { message }
            }
          }`,
        { id: order.id, tags: [TAGS.THURSDAY_EMAIL_SENT] },
      );

      await graphqlJson(
        admin,
        `#graphql
          mutation FridayAddPushedTag($id: ID!, $tags: [String!]!) {
            tagsAdd(id: $id, tags: $tags) {
              userErrors { message }
            }
          }`,
        { id: order.id, tags: [TAGS.PUSHED_TO_NEXT_WEEKEND] },
      );

      if (order.metafield?.id) {
        await graphqlJson(
          admin,
          `#graphql
            mutation ClearThursdayDraftMetafield($metafields: [MetafieldIdentifierInput!]!) {
              metafieldsDelete(metafields: $metafields) {
                deletedMetafields { key }
                userErrors { message }
              }
            }`,
          {
            metafields: [
              {
                ownerId: order.id,
                namespace: META_NAMESPACE,
                key: META_DRAFT_KEY,
              },
            ],
          },
        );
      }
    } catch (error) {
      errors.push(
        `${order.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return {
    ok: errors.length === 0,
    dryRun,
    ordersProcessed,
    draftsDeleted: dryRun ? 0 : draftsDeleted,
    errors,
    message: dryRun
      ? `Dry run: ${ordersProcessed} unpaid thursday order(s) would reset`
      : `Friday reset: ${ordersProcessed} order(s), ${draftsDeleted} draft(s) deleted`,
  };
}
