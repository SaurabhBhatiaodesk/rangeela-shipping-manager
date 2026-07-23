import {
  hasTag,
  isSkirtDeposit,
  normalizeTags,
  TAGS,
  type StatusAction,
} from "./tags";

export type ShippingOrder = {
  id: string;
  name: string;
  email: string | null;
  createdAt: string;
  tags: string[];
  displayFulfillmentStatus: string | null;
  customerName: string | null;
  shippingCity: string | null;
  shippingCountryCode: string | null;
  isSkirtDeposit: boolean;
  needsShippingPaidAlert: boolean;
};

type AdminGraphql = {
  graphql: (
    query: string,
    options?: { variables?: Record<string, unknown> },
  ) => Promise<Response>;
};

const ORDER_NODE_FIELDS = `
  id
  name
  email
  createdAt
  tags
  displayFulfillmentStatus
  customer {
    displayName
  }
  shippingAddress {
    city
    countryCodeV2
  }
`;

async function fetchOrdersByQuery(
  admin: AdminGraphql,
  query: string,
  first = 50,
): Promise<ShippingOrder[]> {
  const response = await admin.graphql(
    `#graphql
      query ShippingManagerOrders($first: Int!, $query: String!) {
        orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              ${ORDER_NODE_FIELDS}
            }
          }
        }
      }`,
    { variables: { first, query } },
  );

  const json = await response.json();

  if (json.errors?.length) {
    const message = json.errors
      .map((e: { message: string }) => e.message)
      .join("; ");
    throw new Error(message);
  }

  const edges = json.data?.orders?.edges ?? [];

  return edges.map((edge: { node: Record<string, unknown> }) => {
    const node = edge.node;
    const tags = normalizeTags(node.tags as string[] | string);
    const customer = node.customer as { displayName?: string } | null;
    const shipping = node.shippingAddress as
      | { city?: string; countryCodeV2?: string }
      | null;

    return {
      id: node.id as string,
      name: node.name as string,
      email: (node.email as string | null) || null,
      createdAt: node.createdAt as string,
      tags,
      displayFulfillmentStatus:
        (node.displayFulfillmentStatus as string | null) ?? null,
      customerName: customer?.displayName ?? null,
      shippingCity: shipping?.city ?? null,
      shippingCountryCode: shipping?.countryCodeV2 ?? null,
      isSkirtDeposit: isSkirtDeposit(tags),
      needsShippingPaidAlert: false,
    } satisfies ShippingOrder;
  });
}

/**
 * Preorders awaiting readiness: open orders not yet marked arrived / ready-to-ship.
 * Skirt deposits (group + partial) stay until deposit-fulfilled.
 */
export async function fetchAwaitingReadinessOrders(
  admin: AdminGraphql,
): Promise<ShippingOrder[]> {
  const query = [
    "status:open",
    `-tag:${TAGS.READY_TO_SHIP}`,
    `-tag:${TAGS.ARRIVED_IN_CANADA}`,
    `-tag:${TAGS.DEPOSIT_FULFILLED}`,
  ].join(" AND ");

  const orders = await fetchOrdersByQuery(admin, query, 100);

  return orders.filter((order) => {
    if (order.isSkirtDeposit) return true;
    // Exclude pure fulfilled noise; keep unfulfilled / partial for status flow
    const status = (order.displayFulfillmentStatus || "").toUpperCase();
    return status !== "FULFILLED";
  });
}

/**
 * Task 3: new qualifying orders placed after the customer already has shipping-paid.
 */
export async function fetchShippingPaidAlerts(
  admin: AdminGraphql,
): Promise<ShippingOrder[]> {
  const paidOrders = await fetchOrdersByQuery(
    admin,
    `tag:${TAGS.SHIPPING_PAID}`,
    100,
  );

  const paidEmails = new Set(
    paidOrders
      .map((o) => o.email?.toLowerCase())
      .filter((e): e is string => Boolean(e)),
  );

  if (paidEmails.size === 0) return [];

  const candidates = await fetchOrdersByQuery(
    admin,
    [
      "status:open",
      `-tag:${TAGS.SHIPPING_PAID}`,
      `-tag:${TAGS.HOLD_FOR_NEXT_CYCLE}`,
      `(fulfillment_status:unfulfilled OR fulfillment_status:partial)`,
    ].join(" AND "),
    100,
  );

  // Latest shipping-paid date per email — alert only for orders placed after that.
  const latestPaidByEmail = new Map<string, string>();
  for (const paid of paidOrders) {
    if (!paid.email) continue;
    const key = paid.email.toLowerCase();
    const existing = latestPaidByEmail.get(key);
    if (!existing || paid.createdAt > existing) {
      latestPaidByEmail.set(key, paid.createdAt);
    }
  }

  return candidates
    .filter((order) => {
      if (!order.email) return false;
      const key = order.email.toLowerCase();
      if (!paidEmails.has(key)) return false;
      const latestPaidAt = latestPaidByEmail.get(key);
      if (!latestPaidAt) return false;
      if (order.createdAt <= latestPaidAt) return false;

      const city = (order.shippingCity || "").toLowerCase();
      if (city === "saskatoon") return false;

      const country = (order.shippingCountryCode || "").toUpperCase();
      if (country && country !== "CA" && country !== "US") return false;

      return true;
    })
    .map((order) => ({ ...order, needsShippingPaidAlert: true }));
}

export async function addOrderTags(
  admin: AdminGraphql,
  orderId: string,
  tags: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const response = await admin.graphql(
    `#graphql
      mutation AddOrderTags($id: ID!, $tags: [String!]!) {
        tagsAdd(id: $id, tags: $tags) {
          node {
            ... on Order {
              id
              tags
            }
          }
          userErrors {
            message
          }
        }
      }`,
    { variables: { id: orderId, tags } },
  );

  const json = await response.json();
  const userErrors = json.data?.tagsAdd?.userErrors ?? [];
  if (userErrors.length > 0) {
    return { ok: false, error: userErrors.map((e: { message: string }) => e.message).join(", ") };
  }
  return { ok: true };
}

async function getOrderSnapshot(
  admin: AdminGraphql,
  orderId: string,
): Promise<{ email: string | null; tags: string[] } | null> {
  const response = await admin.graphql(
    `#graphql
      query OrderSnapshot($id: ID!) {
        order(id: $id) {
          email
          tags
        }
      }`,
    { variables: { id: orderId } },
  );
  const json = await response.json();
  const order = json.data?.order;
  if (!order) return null;
  return {
    email: order.email || null,
    tags: normalizeTags(order.tags),
  };
}

export async function applyStatusAction(
  admin: AdminGraphql,
  orderId: string,
  action: StatusAction,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const snapshot = await getOrderSnapshot(admin, orderId);
  if (!snapshot) {
    return { ok: false, error: "Order not found" };
  }

  const { tags } = snapshot;

  if (action === "deposit_fulfilled") {
    if (!isSkirtDeposit(tags)) {
      return { ok: false, error: "Order is not a skirt deposit (group + partial)" };
    }
    const result = await addOrderTags(admin, orderId, [TAGS.DEPOSIT_FULFILLED]);
    if (!result.ok) return result;
    return { ok: true, message: "Deposit marked fulfilled" };
  }

  if (action === "hold_for_next_cycle") {
    const result = await addOrderTags(admin, orderId, [TAGS.HOLD_FOR_NEXT_CYCLE]);
    if (!result.ok) return result;
    return { ok: true, message: "Held for next Thursday cycle" };
  }

  if (action === "piece_made") {
    if (hasTag(tags, TAGS.PIECE_MADE)) {
      return { ok: false, error: "Piece Made already marked" };
    }
    const tagResult = await addOrderTags(admin, orderId, [TAGS.PIECE_MADE]);
    if (!tagResult.ok) return tagResult;
    return {
      ok: true,
      message: "Piece Made tagged (Klaviyo email via orders/updated webhook)",
    };
  }

  if (action === "leaving_for_canada") {
    if (!hasTag(tags, TAGS.PIECE_MADE)) {
      return { ok: false, error: "Complete Piece Made first" };
    }
    if (hasTag(tags, TAGS.LEAVING_FOR_CANADA)) {
      return { ok: false, error: "Leaving for Canada already marked" };
    }
    const tagResult = await addOrderTags(admin, orderId, [
      TAGS.LEAVING_FOR_CANADA,
    ]);
    if (!tagResult.ok) return tagResult;
    return {
      ok: true,
      message:
        "Leaving for Canada tagged (Klaviyo email via orders/updated webhook)",
    };
  }

  if (action === "arrived_in_canada") {
    if (!hasTag(tags, TAGS.LEAVING_FOR_CANADA)) {
      return { ok: false, error: "Complete Leaving for Canada first" };
    }
    if (hasTag(tags, TAGS.ARRIVED_IN_CANADA)) {
      return { ok: false, error: "Arrived in Canada already marked" };
    }
    const tagResult = await addOrderTags(admin, orderId, [
      TAGS.ARRIVED_IN_CANADA,
      TAGS.READY_TO_SHIP,
    ]);
    if (!tagResult.ok) return tagResult;
    return {
      ok: true,
      message:
        "Arrived in Canada + ready-to-ship tagged (Klaviyo email via webhook)",
    };
  }

  return { ok: false, error: "Unknown action" };
}
