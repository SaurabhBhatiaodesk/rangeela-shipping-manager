import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import {
  DEFAULT_KLAVIYO_TEMPLATE_IDS,
  DEFAULT_PREORDER_LABELS,
  DEFAULT_PREORDER_TAGS,
  flattenShopSettings,
  getShopSettings,
  parseShopSettingsForm,
  saveShopSettings,
  type ShopSettingsInput,
} from "../lib/klaviyo-settings.server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getShopSettings(session.shop);

  return {
    form: flattenShopSettings(settings),
    klaviyoConfigured: Boolean(process.env.KLAVIYO_API_KEY),
    defaults: {
      tags: DEFAULT_PREORDER_TAGS,
      labels: DEFAULT_PREORDER_LABELS,
      templates: DEFAULT_KLAVIYO_TEMPLATE_IDS,
    },
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") || "save");

  if (intent === "reset_defaults") {
    await saveShopSettings(session.shop, {
      pieceMadeTemplateId: "",
      leavingForCanadaTemplateId: "",
      arrivedInCanadaTemplateId: "",
      thursdayTemplateId: "",
      pieceMade: "",
      leavingForCanada: "",
      arrivedInCanada: "",
      depositFulfilled: "",
      depositFulfilledDone: "",
      pieceMadeTag: "",
      leavingForCanadaTag: "",
      arrivedInCanadaTag: "",
      pieceMadeEmailSentTag: "",
      leavingEmailSentTag: "",
      arrivedEmailSentTag: "",
    });
    const settings = await getShopSettings(session.shop);
    return {
      ok: true as const,
      message: "Reset to built-in defaults",
      form: flattenShopSettings(settings),
    };
  }

  await saveShopSettings(session.shop, parseShopSettingsForm(formData));
  const settings = await getShopSettings(session.shop);
  return {
    ok: true as const,
    message: "Settings saved",
    form: flattenShopSettings(settings),
  };
};

function field(
  form: ShopSettingsInput,
  key: keyof ShopSettingsInput,
): string {
  return form[key];
}

export default function SettingsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const shopify = useAppBridge();
  const [form, setForm] = useState(data.form);

  const saving = navigation.state !== "idle";

  useEffect(() => {
    setForm(data.form);
  }, [data.form]);

  useEffect(() => {
    if (actionData?.ok && actionData.message) {
      shopify.toast.show(actionData.message);
      if (actionData.form) {
        setForm(actionData.form);
      }
    }
  }, [actionData, shopify]);

  const update =
    (key: keyof ShopSettingsInput) =>
    (e: Event & { currentTarget: { value: string } }) => {
      setForm((prev) => ({ ...prev, [key]: e.currentTarget.value }));
    };

  return (
    <s-page heading="Settings" inlineSize="large">
      <s-link slot="breadcrumb-actions" href="/app">
        Shipping Manager
      </s-link>

      {!data.klaviyoConfigured && (
        <s-banner heading="Klaviyo API key is missing" tone="warning">
          <s-paragraph>
            Template IDs are saved here, but emails will not send until{" "}
            <s-text type="strong">KLAVIYO_API_KEY</s-text> is set in your app
            environment (Heroku config or .env).
          </s-paragraph>
        </s-banner>
      )}

      <s-banner heading="How settings apply" tone="info">
        <s-paragraph>
          Order tags are added when you click buttons on the Preorders tab.
          Klaviyo template IDs are sent on each status email event. Leave a
          field blank to use the built-in default shown in the hint.
        </s-paragraph>
      </s-banner>

      <Form method="post">
        <input type="hidden" name="intent" value="save" />
        <s-stack direction="block" gap="large">
          <s-section heading="Shopify order tags" padding="base">
            <s-stack direction="block" gap="base">
              <s-paragraph>
                Tags applied to orders for each preorder workflow step. Also
                used by status email polling and the Thursday invoice pool.
              </s-paragraph>
              <s-text-field
                label="Piece Made status tag"
                name="pieceMadeTag"
                value={field(form, "pieceMadeTag")}
                details={`Default: ${data.defaults.tags.pieceMadeTag}`}
                onChange={update("pieceMadeTag")}
              />
              <s-text-field
                label="Leaving for Canada status tag"
                name="leavingForCanadaTag"
                value={field(form, "leavingForCanadaTag")}
                details={`Default: ${data.defaults.tags.leavingForCanadaTag}`}
                onChange={update("leavingForCanadaTag")}
              />
              <s-text-field
                label="Arrived in Canada status tag"
                name="arrivedInCanadaTag"
                value={field(form, "arrivedInCanadaTag")}
                details={`Default: ${data.defaults.tags.arrivedInCanadaTag}`}
                onChange={update("arrivedInCanadaTag")}
              />
              <s-text-field
                label="Piece Made email-sent tag"
                name="pieceMadeEmailSentTag"
                value={field(form, "pieceMadeEmailSentTag")}
                details={`Default: ${data.defaults.tags.pieceMadeEmailSentTag}`}
                onChange={update("pieceMadeEmailSentTag")}
              />
              <s-text-field
                label="Leaving email-sent tag"
                name="leavingEmailSentTag"
                value={field(form, "leavingEmailSentTag")}
                details={`Default: ${data.defaults.tags.leavingEmailSentTag}`}
                onChange={update("leavingEmailSentTag")}
              />
              <s-text-field
                label="Arrived email-sent tag"
                name="arrivedEmailSentTag"
                value={field(form, "arrivedEmailSentTag")}
                details={`Default: ${data.defaults.tags.arrivedEmailSentTag}`}
                onChange={update("arrivedEmailSentTag")}
              />
            </s-stack>
          </s-section>

          <s-section heading="Preorder button labels" padding="base">
            <s-stack direction="block" gap="base">
              <s-paragraph>
                Text shown on action buttons and completed-step badges on the
                Preorders tab.
              </s-paragraph>
              <s-text-field
                label="Piece Made button / badge"
                name="pieceMade"
                value={field(form, "pieceMade")}
                details={`Default: ${data.defaults.labels.pieceMade}`}
                onChange={update("pieceMade")}
              />
              <s-text-field
                label="Leaving for Canada button / badge"
                name="leavingForCanada"
                value={field(form, "leavingForCanada")}
                details={`Default: ${data.defaults.labels.leavingForCanada}`}
                onChange={update("leavingForCanada")}
              />
              <s-text-field
                label="Arrived in Canada button / badge"
                name="arrivedInCanada"
                value={field(form, "arrivedInCanada")}
                details={`Default: ${data.defaults.labels.arrivedInCanada}`}
                onChange={update("arrivedInCanada")}
              />
              <s-text-field
                label="Skirt deposit button"
                name="depositFulfilled"
                value={field(form, "depositFulfilled")}
                details={`Default: ${data.defaults.labels.depositFulfilled}`}
                onChange={update("depositFulfilled")}
              />
              <s-text-field
                label="Skirt deposit completed badge"
                name="depositFulfilledDone"
                value={field(form, "depositFulfilledDone")}
                details={`Default: ${data.defaults.labels.depositFulfilledDone}`}
                onChange={update("depositFulfilledDone")}
              />
            </s-stack>
          </s-section>

          <s-section heading="Klaviyo template IDs" padding="base">
            <s-stack direction="block" gap="base">
              <s-paragraph>
                Short ID from the Klaviyo template URL. Sent on each Klaviyo
                event — your Flow must use the matching template.
              </s-paragraph>
              <s-text-field
                label="Piece Made template ID"
                name="pieceMadeTemplateId"
                value={field(form, "pieceMadeTemplateId")}
                details={`Default: ${data.defaults.templates.pieceMade}`}
                onChange={update("pieceMadeTemplateId")}
              />
              <s-text-field
                label="Leaving for Canada template ID"
                name="leavingForCanadaTemplateId"
                value={field(form, "leavingForCanadaTemplateId")}
                details={`Default: ${data.defaults.templates.leavingForCanada}`}
                onChange={update("leavingForCanadaTemplateId")}
              />
              <s-text-field
                label="Arrived in Canada template ID"
                name="arrivedInCanadaTemplateId"
                value={field(form, "arrivedInCanadaTemplateId")}
                details={`Default: ${data.defaults.templates.arrivedInCanada}`}
                onChange={update("arrivedInCanadaTemplateId")}
              />
              <s-text-field
                label="Thursday shipping invoice template ID"
                name="thursdayTemplateId"
                value={field(form, "thursdayTemplateId")}
                details={`Default: ${data.defaults.templates.thursday}`}
                onChange={update("thursdayTemplateId")}
              />
            </s-stack>
          </s-section>

          <s-button-group gap="base" accessibilityLabel="Settings actions">
            <s-button
              slot="primary-action"
              variant="primary"
              type="submit"
              disabled={saving}
              {...(saving ? { loading: true } : {})}
            >
              Save settings
            </s-button>
          </s-button-group>
        </s-stack>
      </Form>

      <s-section heading="Reset" padding="base">
        <s-paragraph>
          Clears all saved overrides for this shop. The app will use built-in
          defaults and environment variables again.
        </s-paragraph>
        <Form method="post">
          <input type="hidden" name="intent" value="reset_defaults" />
          <s-button
            variant="secondary"
            tone="critical"
            type="submit"
            disabled={saving}
          >
            Reset to defaults
          </s-button>
        </Form>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
