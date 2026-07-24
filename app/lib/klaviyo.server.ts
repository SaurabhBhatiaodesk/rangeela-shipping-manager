import {
  KLAVIYO_TEMPLATES,
  KLAVIYO_THURSDAY_METRIC,
  TAGS,
} from "./tags";

type KlaviyoTemplateKey =
  | typeof TAGS.PIECE_MADE
  | typeof TAGS.LEAVING_FOR_CANADA
  | typeof TAGS.ARRIVED_IN_CANADA;

export type KlaviyoSendResult =
  | { ok: true; skipped?: boolean; reason?: string }
  | { ok: false; error: string };

const KLAVIYO_REVISION = "2024-10-15";

/**
 * Creates a Klaviyo event. A metric-triggered Flow must send the email.
 * Direct template send (/api/messages/send/) does not exist on current API.
 */
async function createKlaviyoEvent(options: {
  email: string;
  metricName: string;
  properties?: Record<string, string>;
  uniqueId?: string;
}): Promise<KlaviyoSendResult> {
  const apiKey = process.env.KLAVIYO_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "KLAVIYO_API_KEY is not set. Add it to your app environment.",
    };
  }

  const attributes: Record<string, unknown> = {
    properties: options.properties ?? {},
    metric: {
      data: {
        type: "metric",
        attributes: { name: options.metricName },
      },
    },
    profile: {
      data: {
        type: "profile",
        attributes: { email: options.email },
      },
    },
  };

  if (options.uniqueId) {
    attributes.unique_id = options.uniqueId;
  }

  const response = await fetch("https://a.klaviyo.com/api/events/", {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      revision: KLAVIYO_REVISION,
      "Content-Type": "application/vnd.api+json",
      Accept: "application/vnd.api+json",
    },
    body: JSON.stringify({
      data: {
        type: "event",
        attributes,
      },
    }),
  });

  // Create Event returns 202 Accepted on success
  if (response.status !== 202 && !response.ok) {
    const body = await response.text();
    return {
      ok: false,
      error: `Klaviyo ${response.status}: ${body.slice(0, 300)}`,
    };
  }

  return { ok: true };
}

/**
 * Fires a preorder status metric so the matching Klaviyo Flow can email.
 */
export async function sendPreorderStatusEmail(options: {
  email: string | null | undefined;
  statusTag: KlaviyoTemplateKey;
  alreadySent: boolean;
  uniqueId?: string;
}): Promise<KlaviyoSendResult> {
  const { email, statusTag, alreadySent } = options;

  if (alreadySent) {
    return { ok: true, skipped: true, reason: "already_sent" };
  }

  if (!email) {
    return { ok: false, error: "Order has no customer email" };
  }

  const template = KLAVIYO_TEMPLATES[statusTag];
  if (!template) {
    return { ok: false, error: `Unknown status tag: ${statusTag}` };
  }

  return createKlaviyoEvent({
    email,
    metricName: template.metricName,
    uniqueId: options.uniqueId,
    properties: {
      status_tag: statusTag,
      template_id: template.templateId,
      subject: template.subject,
    },
  });
}

/**
 * Thursday combined shipping invoice — triggers metric
 * `Rangeela Thursday Shipping Invoice` (Flow uses template from env/docs).
 */
export async function sendThursdayInvoiceEmail(options: {
  email: string;
  invoiceUrl: string;
  waitUrl: string;
  orderNames: string[];
  shippingAmount: string;
  uniqueId?: string;
}): Promise<KlaviyoSendResult> {
  const templateId = process.env.KLAVIYO_THURSDAY_TEMPLATE_ID;
  if (!templateId) {
    return {
      ok: false,
      error:
        "KLAVIYO_THURSDAY_TEMPLATE_ID is not set. Add the Thursday invoice template id.",
    };
  }

  if (!options.invoiceUrl) {
    return { ok: false, error: "Draft order has no invoiceUrl" };
  }

  return createKlaviyoEvent({
    email: options.email,
    metricName: KLAVIYO_THURSDAY_METRIC,
    uniqueId: options.uniqueId,
    properties: {
      template_id: templateId,
      invoice_url: options.invoiceUrl,
      wait_url: options.waitUrl,
      order_names: options.orderNames.join(", "),
      shipping_amount: options.shippingAmount,
    },
  });
}
