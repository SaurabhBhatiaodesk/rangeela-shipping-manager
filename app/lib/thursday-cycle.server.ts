import { TAGS, hasTag, normalizeTags } from "./tags";
import {
  shippingAmountForItemCount,
  SHIPPING_CURRENCY,
} from "./shipping-rates";
import {
  type AdminGraphql,
  type CycleOrder,
  type LineItemInfo,
  countCanadaDispatchItems,
  graphqlJson,
  hasIndiaItems,
  isCanadaOrUsShipping,
  isSaskatoon,
  passesCycleTagGate,
} from "./cycle-shared.server";
import { sendThursdayInvoiceEmail } from "./klaviyo.server";

const META_NAMESPACE = "rangeela";
const META_DRAFT_KEY = "thursday_draft_id";

const CYCLE_ORDER_FIELDS = `
  id
  name
  email
  createdAt
  tags
  displayFinancialStatus
  displayFulfillmentStatus
  customer {
    id
    displayName
  }
  shippingAddress {
    address1
    address2
    city
    provinceCode
    countryCodeV2
    zip
    firstName
    lastName
    phone
  }
  metafield(namespace: "${META_NAMESPACE}", key: "${META_DRAFT_KEY}") {
    value
  }
  lineItems(first: 100) {
    edges {
      node {
        title
        quantity
        product {
          tags
        }
      }
    }
  }
`;

function mapOrder(node: Record<string, unknown>): CycleOrder {
  const tags = normalizeTags(node.tags as string[] | string);
  const customer = node.customer as
    | { id?: string; displayName?: string }
    | null;
  const shipping = node.shippingAddress as Record<string, string | null> | null;
  const metafield = node.metafield as { value?: string } | null;
  const lineEdges =
    (
      node.lineItems as {
        edges: { node: Record<string, unknown> }[];
      }
    )?.edges ?? [];

  const lineItems: LineItemInfo[] = lineEdges.map((edge) => {
    const li = edge.node;
    const product = li.product as { tags?: string[] | string } | null;
    return {
      title: String(li.title || ""),
      quantity: Number(li.quantity || 0),
      productTags: normalizeTags(product?.tags),
    };
  });

  return {
    id: node.id as string,
    name: node.name as string,
    email: (node.email as string | null) || null,
    tags,
    createdAt: node.createdAt as string,
    displayFinancialStatus:
      (node.displayFinancialStatus as string | null) ?? null,
    displayFulfillmentStatus:
      (node.displayFulfillmentStatus as string | null) ?? null,
    shippingCity: shipping?.city ?? null,
    shippingCountryCode: shipping?.countryCodeV2 ?? null,
    shippingAddress: shipping
      ? {
          address1: shipping.address1 ?? null,
          address2: shipping.address2 ?? null,
          city: shipping.city ?? null,
          provinceCode: shipping.provinceCode ?? null,
          countryCode: shipping.countryCodeV2 ?? null,
          zip: shipping.zip ?? null,
          firstName: shipping.firstName ?? null,
          lastName: shipping.lastName ?? null,
          phone: shipping.phone ?? null,
        }
      : null,
    customerId: customer?.id ?? null,
    customerName: customer?.displayName ?? null,
    lineItems,
    thursdayDraftId: metafield?.value ?? null,
  };
}

async function fetchCycleOrders(
  admin: AdminGraphql,
  query: string,
  first = 100,
): Promise<CycleOrder[]> {
  const json = await graphqlJson(
    admin,
    `#graphql
      query ThursdayCycleOrders($first: Int!, $query: String!) {
        orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
          edges {
            node {
              ${CYCLE_ORDER_FIELDS}
            }
          }
        }
      }`,
    { first, query },
  );

  return (json.data?.orders?.edges ?? []).map(
    (e: { node: Record<string, unknown> }) => mapOrder(e.node),
  );
}

function isPool1Preorder(order: CycleOrder): boolean {
  if (!hasTag(order.tags, TAGS.ARRIVED_IN_CANADA)) return false;
  if (!hasTag(order.tags, TAGS.READY_TO_SHIP)) return false;
  if (!passesCycleTagGate(order.tags)) return false;
  if (isSaskatoon(order)) return false;
  if (!isCanadaOrUsShipping(order)) return false;
  if (hasIndiaItems(order.lineItems) && countCanadaDispatchItems(order.lineItems) === 0) {
    return false;
  }
  // Prefer counting canada/dispatch; if none tagged, count all non-india qty as fallback for pure preorders
  return true;
}

function isPool2Rtw(order: CycleOrder): boolean {
  const financial = (order.displayFinancialStatus || "").toUpperCase();
  const fulfillment = (order.displayFulfillmentStatus || "").toUpperCase();
  if (financial !== "PAID") return false;
  if (fulfillment === "FULFILLED") return false;
  if (!passesCycleTagGate(order.tags)) return false;
  if (isSaskatoon(order)) return false;
  if (!isCanadaOrUsShipping(order)) return false;

  const canadaCount = countCanadaDispatchItems(order.lineItems);
  if (canadaCount < 1) return false;

  // Mixed or india-only excluded
  if (hasIndiaItems(order.lineItems)) return false;

  return true;
}

function billableItemCount(order: CycleOrder): number {
  const tagged = countCanadaDispatchItems(order.lineItems);
  if (tagged > 0) return tagged;
  // Preorders may not use canada/dispatch product tags — count non-india units
  return order.lineItems.reduce((sum, item) => {
    if (productHasIndia(item.productTags)) return sum;
    return sum + item.quantity;
  }, 0);
}

function productHasIndia(tags: string[]): boolean {
  return tags.some((t) => t.toLowerCase() === "india");
}

export type ThursdayCustomerResult = {
  email: string;
  orderNames: string[];
  itemCount: number;
  shippingAmount: string;
  draftOrderId?: string;
  invoiceUrl?: string;
  emailSent?: boolean;
  error?: string;
};

export type ThursdayCycleResult = {
  ok: boolean;
  dryRun: boolean;
  customersProcessed: number;
  results: ThursdayCustomerResult[];
  message: string;
};

async function addTags(
  admin: AdminGraphql,
  id: string,
  tags: string[],
) {
  const json = await graphqlJson(
    admin,
    `#graphql
      mutation CycleTagsAdd($id: ID!, $tags: [String!]!) {
        tagsAdd(id: $id, tags: $tags) {
          userErrors { message }
        }
      }`,
    { id, tags },
  );
  const errors = json.data?.tagsAdd?.userErrors ?? [];
  if (errors.length) {
    throw new Error(errors.map((e: { message: string }) => e.message).join(", "));
  }
}

async function removeTags(
  admin: AdminGraphql,
  id: string,
  tags: string[],
) {
  const json = await graphqlJson(
    admin,
    `#graphql
      mutation CycleTagsRemove($id: ID!, $tags: [String!]!) {
        tagsRemove(id: $id, tags: $tags) {
          userErrors { message }
        }
      }`,
    { id, tags },
  );
  const errors = json.data?.tagsRemove?.userErrors ?? [];
  if (errors.length) {
    throw new Error(errors.map((e: { message: string }) => e.message).join(", "));
  }
}

async function setDraftMetafield(
  admin: AdminGraphql,
  orderId: string,
  draftId: string,
) {
  await graphqlJson(
    admin,
    `#graphql
      mutation SetThursdayDraftMetafield($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors { message }
        }
      }`,
    {
      metafields: [
        {
          ownerId: orderId,
          namespace: META_NAMESPACE,
          key: META_DRAFT_KEY,
          type: "single_line_text_field",
          value: draftId,
        },
      ],
    },
  );
}

function serializeLinkedOrderIds(linkedOrderIds: Array<string | number>) {
  return JSON.stringify(linkedOrderIds.map(String));
}

async function attachLinkedOrderIdsToDraft(
  admin: AdminGraphql,
  draftOrderId: string,
  linkedOrderIds: Array<string | number>,
) {
  if (!linkedOrderIds.length) return;

  await graphqlJson(
    admin,
    `#graphql
      mutation AttachLinkedOrderIdsToDraft($input: DraftOrderInput!) {
        draftOrderUpdate(input: $input) {
          draftOrder { id noteAttributes { name value } }
          userErrors { field message }
        }
      }
    `,
    {
      input: {
        id: draftOrderId,
        noteAttributes: [
          {
            name: "linked_order_ids",
            value: serializeLinkedOrderIds(linkedOrderIds),
          },
        ],
      },
    },
  );

  console.log(
    "Thursday draft invoice linked_order_ids attached:",
    draftOrderId,
    linkedOrderIds,
  );
}

async function createShippingDraft(
  admin: AdminGraphql,
  orders: CycleOrder[],
  email: string,
  amount: string,
  linkedOrderIds: Array<string | number>,
): Promise<{ id: string; invoiceUrl: string | null; name: string }> {
  const note = `Combined orders: ${orders.map((o) => o.name).join(", ")}`;
  const primary = orders[0]!;
  const address = primary.shippingAddress;

  const input: Record<string, unknown> = {
    email,
    note,
    tags: ["rangeela-thursday-shipping", "shipping-invoice"],
    customAttributes: [
      {
        key: "source_order_ids",
        value: orders.map((o) => o.id).join(","),
      },
    ],
    noteAttributes: [
      {
        name: "linked_order_ids",
        value: serializeLinkedOrderIds(linkedOrderIds),
      },
    ],
    lineItems: [
      {
        title: "Shipping fee",
        originalUnitPrice: amount,
        quantity: 1,
        requiresShipping: false,
      },
    ],
  };

  if (primary.customerId) {
    input.customerId = primary.customerId;
  }

  if (address?.address1 && address.city && address.countryCode && address.zip) {
    input.shippingAddress = {
      address1: address.address1,
      address2: address.address2,
      city: address.city,
      provinceCode: address.provinceCode,
      countryCode: address.countryCode,
      zip: address.zip,
      firstName: address.firstName,
      lastName: address.lastName,
      phone: address.phone,
    };
  }

  const json = await graphqlJson(
    admin,
    `#graphql
      mutation CreateThursdayDraft($input: DraftOrderInput!) {
        draftOrderCreate(input: $input) {
          draftOrder {
            id
            name
            invoiceUrl
          }
          userErrors { field message }
        }
      }`,
    { input },
  );

  const payload = json.data?.draftOrderCreate;
  const userErrors = payload?.userErrors ?? [];
  if (userErrors.length) {
    throw new Error(
      userErrors.map((e: { message: string }) => e.message).join(", "),
    );
  }

  const draft = payload.draftOrder;
  return {
    id: draft.id,
    name: draft.name,
    invoiceUrl: draft.invoiceUrl,
  };
}

/**
 * Thursday cycle: pool preorders + RTW, combine by email, create one draft invoice,
 * email via Klaviyo, tag originals thursday-email-sent, clear hold/pushed tags.
 */
export async function runThursdayCycle(
  admin: AdminGraphql,
  options: { dryRun?: boolean } = {},
): Promise<ThursdayCycleResult> {
  const dryRun = Boolean(options.dryRun);

  const [pool1Raw, pool2Raw] = await Promise.all([
    fetchCycleOrders(
      admin,
      [
        "status:open",
        `tag:${TAGS.ARRIVED_IN_CANADA}`,
        `tag:${TAGS.READY_TO_SHIP}`,
      ].join(" AND "),
    ),
    fetchCycleOrders(
      admin,
      [
        "status:open",
        "financial_status:paid",
        "(fulfillment_status:unfulfilled OR fulfillment_status:partial)",
      ].join(" AND "),
    ),
  ]);

  const pool1 = pool1Raw.filter(isPool1Preorder);
  const pool2 = pool2Raw.filter(isPool2Rtw);

  const byId = new Map<string, CycleOrder>();
  for (const order of [...pool1, ...pool2]) {
    byId.set(order.id, order);
  }

  const byEmail = new Map<string, CycleOrder[]>();
  for (const order of byId.values()) {
    if (!order.email) continue;
    const key = order.email.toLowerCase();
    const list = byEmail.get(key) ?? [];
    list.push(order);
    byEmail.set(key, list);
  }

  const results: ThursdayCustomerResult[] = [];

  for (const [email, orders] of byEmail) {
    const itemCount = orders.reduce(
      (sum, order) => sum + billableItemCount(order),
      0,
    );
    if (itemCount <= 0) continue;

    const shippingAmount = shippingAmountForItemCount(itemCount);
    const orderNames = orders.map((o) => o.name);
    const row: ThursdayCustomerResult = {
      email,
      orderNames,
      itemCount,
      shippingAmount: `${shippingAmount} ${SHIPPING_CURRENCY}`,
    };

    if (dryRun) {
      results.push(row);
      continue;
    }

    try {
      const draft = await createShippingDraft(
        admin,
        orders,
        email,
        shippingAmount,
        orders.map((o) => o.id),
      );
      row.draftOrderId = draft.id;
      row.invoiceUrl = draft.invoiceUrl || undefined;

      const waitUrl =
        process.env.THURSDAY_WAIT_URL ||
        process.env.SHOPIFY_APP_URL ||
        "";

      const emailResult = await sendThursdayInvoiceEmail({
        email,
        invoiceUrl: draft.invoiceUrl || "",
        waitUrl,
        orderNames,
        shippingAmount: row.shippingAmount,
        uniqueId: `thursday:${draft.id}`,
      });

      // Draft + tags always apply; email failure is reported but does not block tags
      if (emailResult.ok && !emailResult.skipped) {
        row.emailSent = true;
      } else if (!emailResult.ok) {
        row.error = `Invoice created; email pending: ${emailResult.error}`;
        row.emailSent = false;
      }

      for (const order of orders) {
        await addTags(admin, order.id, [TAGS.THURSDAY_EMAIL_SENT]);
        await setDraftMetafield(admin, order.id, draft.id);

        const toRemove: string[] = [];
        if (hasTag(order.tags, TAGS.PUSHED_TO_NEXT_WEEKEND)) {
          toRemove.push(TAGS.PUSHED_TO_NEXT_WEEKEND);
        }
        if (hasTag(order.tags, TAGS.HOLD_FOR_NEXT_CYCLE)) {
          toRemove.push(TAGS.HOLD_FOR_NEXT_CYCLE);
        }
        if (toRemove.length) {
          await removeTags(admin, order.id, toRemove);
        }
      }
    } catch (error) {
      row.error = error instanceof Error ? error.message : String(error);
    }

    results.push(row);
  }

  return {
    ok: results.every((r) => !r.error),
    dryRun,
    customersProcessed: results.length,
    results,
    message: dryRun
      ? `Dry run: ${results.length} customer invoice(s) would be created`
      : `Thursday cycle finished: ${results.length} customer invoice(s)`,
  };
}

export async function previewThursdayPools(admin: AdminGraphql) {
  const result = await runThursdayCycle(admin, { dryRun: true });
  return result;
}
