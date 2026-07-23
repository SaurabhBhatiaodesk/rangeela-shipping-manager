import { KLAVIYO_TEMPLATES, TAGS } from "./tags";

type KlaviyoTemplateKey =
  | typeof TAGS.PIECE_MADE
  | typeof TAGS.LEAVING_FOR_CANADA
  | typeof TAGS.ARRIVED_IN_CANADA;

export type KlaviyoSendResult =
  | { ok: true; skipped?: boolean; reason?: string }
  | { ok: false; error: string };

async function sendKlaviyoTemplate(options: {
  email: string;
  templateId: string;
  label: string;
  /** Optional properties for template personalization (API-dependent). */
  properties?: Record<string, string>;
}): Promise<KlaviyoSendResult> {
  const apiKey = process.env.KLAVIYO_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "KLAVIYO_API_KEY is not set. Add it to your app environment.",
    };
  }

  const recipient: Record<string, unknown> = {
    address: options.email,
  };
  if (options.properties) {
    recipient.properties = options.properties;
  }

  const response = await fetch("https://a.klaviyo.com/api/messages/send/", {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      revision: "2023-12-15",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      data: {
        type: "message-send-job",
        attributes: {
          message: {
            channel: "email",
            label: options.label,
            recipients: [recipient],
            content: {
              template_id: options.templateId,
            },
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return {
      ok: false,
      error: `Klaviyo ${response.status}: ${body.slice(0, 300)}`,
    };
  }

  return { ok: true };
}

/**
 * Sends a one-off Klaviyo email for a preorder status tag.
 */
export async function sendPreorderStatusEmail(options: {
  email: string | null | undefined;
  statusTag: KlaviyoTemplateKey;
  alreadySent: boolean;
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

  return sendKlaviyoTemplate({
    email,
    templateId: template.templateId,
    label: "Preorder status update",
  });
}

/**
 * Thursday combined shipping invoice email (invoice URL + wait URL).
 * Template ID: KLAVIYO_THURSDAY_TEMPLATE_ID
 */
export async function sendThursdayInvoiceEmail(options: {
  email: string;
  invoiceUrl: string;
  waitUrl: string;
  orderNames: string[];
  shippingAmount: string;
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

  return sendKlaviyoTemplate({
    email: options.email,
    templateId,
    label: "Thursday shipping invoice",
    properties: {
      invoice_url: options.invoiceUrl,
      wait_url: options.waitUrl,
      order_names: options.orderNames.join(", "),
      shipping_amount: options.shippingAmount,
    },
  });
}
