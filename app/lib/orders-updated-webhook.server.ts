import type { AdminGraphql } from "./cycle-shared.server";
import { graphqlJson } from "./cycle-shared.server";

function parseLinkedOrderIds(value: unknown): string[] {
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .flatMap((item) =>
          typeof item === "string" || typeof item === "number"
            ? String(item).trim()
            : [],
        )
        .filter(Boolean);
    }
  } catch {
    // not JSON
  }

  return trimmed
    .split(/[\s,|,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractLinkedOrderIdsFromPayload(orderPayload: any): string[] {
  const ids = new Set<string>();

  if (Array.isArray(orderPayload?.note_attributes)) {
    for (const attr of orderPayload.note_attributes) {
      if (attr?.name === "linked_order_ids" && attr?.value) {
        parseLinkedOrderIds(attr.value).forEach((id) => ids.add(id));
      }
    }
  }

  if (typeof orderPayload?.note === "string") {
    const note = orderPayload.note.trim();
    try {
      const parsed = JSON.parse(note);
      if (parsed?.linked_order_ids) {
        parseLinkedOrderIds(JSON.stringify(parsed.linked_order_ids)).forEach(
          (id) => ids.add(id),
        );
      }
    } catch {
      const match = note.match(/linked_order_ids\s*[:=]\s*([\d,\s|]+)/i);
      if (match?.[1]) {
        parseLinkedOrderIds(match[1]).forEach((id) => ids.add(id));
      }
    }
  }

  if (orderPayload?.tags) {
    const tags =
      typeof orderPayload.tags === "string"
        ? orderPayload.tags.split(",")
        : Array.isArray(orderPayload.tags)
        ? orderPayload.tags
        : [];
    for (const tag of tags) {
      const match = String(tag).match(/linked_order_ids\s*[:=]\s*([\d,\s|]+)/i);
      if (match?.[1]) {
        parseLinkedOrderIds(match[1]).forEach((id) => ids.add(id));
      }
    }
  }

  return [...ids];
}

function normalizeOrderGid(id: string): string | null {
  const value = String(id || "").trim();
  if (!value) return null;
  if (value.startsWith("gid://")) return value;
  if (/^\d+$/.test(value)) return `gid://shopify/Order/${value}`;
  return null;
}

export async function processShippingPaidTagging(
  admin: AdminGraphql,
  orderPayload: any,
) {
  const invoiceId =
    String(orderPayload.admin_graphql_api_id || orderPayload.id || "unknown");
  const financialStatus = String(orderPayload.financial_status || "").toLowerCase();

  if (financialStatus !== "paid") {
    console.log("shipping-paid tagging skipped; invoice not paid:", invoiceId);
    return;
  }

  console.log("paid invoice detected:", invoiceId);

  const linkedOrderIds = extractLinkedOrderIdsFromPayload(orderPayload);
  if (linkedOrderIds.length === 0) {
    console.log("No linked original orders found on paid invoice:", invoiceId);
    return;
  }

  console.log(
    "linked original orders found for paid invoice:",
    invoiceId,
    linkedOrderIds,
  );

  for (const linkedId of linkedOrderIds) {
    const linkedOrderGid = normalizeOrderGid(linkedId);
    if (!linkedOrderGid) {
      console.log("skipped linked order because ID is invalid:", linkedId);
      continue;
    }

    try {
      const fetchRes: any = await graphqlJson(
        admin,
        `#graphql
          query GetOrderTags($id: ID!) {
            order(id: $id) {
              id
              tags
            }
          }
        `,
        { id: linkedOrderGid },
      );

      const existingTags =
        fetchRes?.data?.order?.tags ??
        fetchRes?.body?.data?.order?.tags ??
        [];
      const tagsArray = Array.isArray(existingTags)
        ? existingTags
        : String(existingTags || "")
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);

      if (tagsArray.includes("shipping-paid")) {
        console.log(
          `skipped tagging order ${linkedId} (already has shipping-paid)`,
        );
        continue;
      }

      const updatedTags = Array.from(new Set([...tagsArray, "shipping-paid"])).join(
        ", ",
      );

      const updateRes: any = await graphqlJson(
        admin,
        `#graphql
          mutation OrderUpdate($input: OrderInput!) {
            orderUpdate(input: $input) {
              order { id tags }
              userErrors { field message }
            }
          }
        `,
        {
          input: {
            id: linkedOrderGid,
            tags: updatedTags,
          },
        },
      );

      const userErrors =
        updateRes?.data?.orderUpdate?.userErrors ??
        updateRes?.body?.data?.orderUpdate?.userErrors;
      if (Array.isArray(userErrors) && userErrors.length > 0) {
        console.error("Failed to add shipping-paid tag to order", linkedId, userErrors);
      } else {
        console.log("shipping-paid tag added to order", linkedId);
      }
    } catch (error) {
      console.error("Failed to process linked order", linkedId, error);
    }
  }
}
