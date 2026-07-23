import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  orderGidFromWebhookPayload,
  parseWebhookOrderTags,
  processStatusEmailsFromOrderUpdate,
  voidThursdayDraftIfPushed,
} from "../lib/orders-updated-webhook.server";

/**
 * orders/updated webhook
 * - Task 1: status tags → Klaviyo email + email-sent tags
 * - Task 4b: pushed-to-next-weekend → void Thursday draft via metafield
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, admin, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  if (!admin) {
    console.error(
      `[orders/updated] No admin API client for ${shop} (offline session missing?)`,
    );
    return new Response();
  }

  const orderPayload = payload as {
    id?: number | string;
    admin_graphql_api_id?: string;
    email?: string | null;
    contact_email?: string | null;
    tags?: string | string[];
  };

  const orderGid = orderGidFromWebhookPayload(orderPayload);
  const tags = parseWebhookOrderTags(orderPayload);
  const email = orderPayload.email || orderPayload.contact_email || null;

  try {
    await processStatusEmailsFromOrderUpdate(admin, {
      orderGid,
      email,
      tags: [...tags],
    });

    await voidThursdayDraftIfPushed(admin, orderGid, tags);
  } catch (error) {
    console.error(`[orders/updated] handler error for ${orderGid}:`, error);
  }

  return new Response();
};
