import prisma from "../db.server";
import { TAGS, type StatusEmailAction } from "./tags";

/** Default Klaviyo template IDs (used when admin has not saved overrides). */
export const DEFAULT_KLAVIYO_TEMPLATE_IDS = {
  pieceMade: "WMcvs7",
  leavingForCanada: "TB2w7d",
  arrivedInCanada: "XmXMMJ",
  thursday: "YwNtLP",
} as const;

/** Default button and badge labels on the Preorders tab. */
export const DEFAULT_PREORDER_LABELS = {
  pieceMade: "Piece Made",
  leavingForCanada: "Leaving for Canada",
  arrivedInCanada: "Arrived in Canada",
  depositFulfilled: "Mark Deposit Fulfilled",
  depositFulfilledDone: "Deposit fulfilled",
} as const;

/** Default Shopify order tags for the preorder workflow. */
export const DEFAULT_PREORDER_TAGS = {
  pieceMadeTag: TAGS.PIECE_MADE,
  leavingForCanadaTag: TAGS.LEAVING_FOR_CANADA,
  arrivedInCanadaTag: TAGS.ARRIVED_IN_CANADA,
  pieceMadeEmailSentTag: TAGS.PIECE_MADE_EMAIL_SENT,
  leavingEmailSentTag: TAGS.LEAVING_EMAIL_SENT,
  arrivedEmailSentTag: TAGS.ARRIVED_EMAIL_SENT,
} as const;

export type KlaviyoTemplateIds = {
  pieceMadeTemplateId: string;
  leavingForCanadaTemplateId: string;
  arrivedInCanadaTemplateId: string;
  thursdayTemplateId: string;
};

export type PreorderWorkflowLabels = {
  pieceMade: string;
  leavingForCanada: string;
  arrivedInCanada: string;
  depositFulfilled: string;
  depositFulfilledDone: string;
};

export type PreorderWorkflowTags = {
  pieceMadeTag: string;
  leavingForCanadaTag: string;
  arrivedInCanadaTag: string;
  pieceMadeEmailSentTag: string;
  leavingEmailSentTag: string;
  arrivedEmailSentTag: string;
};

export type ShopAppSettings = {
  klaviyoTemplates: KlaviyoTemplateIds;
  preorderLabels: PreorderWorkflowLabels;
  preorderTags: PreorderWorkflowTags;
};

export type ShopSettingsInput = KlaviyoTemplateIds &
  PreorderWorkflowLabels &
  PreorderWorkflowTags;

function trimOrEmpty(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function resolveId(
  stored: string | undefined,
  envValue: string | undefined,
  fallback: string,
): string {
  const fromDb = trimOrEmpty(stored);
  if (fromDb) return fromDb;
  const fromEnv = trimOrEmpty(envValue);
  if (fromEnv) return fromEnv;
  return fallback;
}

function resolveLabel(stored: string | undefined, fallback: string): string {
  const fromDb = trimOrEmpty(stored);
  return fromDb || fallback;
}

function resolveTag(stored: string | undefined, fallback: string): string {
  const fromDb = trimOrEmpty(stored);
  return fromDb || fallback;
}

export async function getShopSettings(shop: string): Promise<ShopAppSettings> {
  const row = await prisma.shopKlaviyoSettings.findUnique({ where: { shop } });

  return {
    klaviyoTemplates: {
      pieceMadeTemplateId: resolveId(
        row?.pieceMadeTemplateId,
        process.env.KLAVIYO_PIECE_MADE_TEMPLATE_ID,
        DEFAULT_KLAVIYO_TEMPLATE_IDS.pieceMade,
      ),
      leavingForCanadaTemplateId: resolveId(
        row?.leavingForCanadaTemplateId,
        process.env.KLAVIYO_LEAVING_TEMPLATE_ID,
        DEFAULT_KLAVIYO_TEMPLATE_IDS.leavingForCanada,
      ),
      arrivedInCanadaTemplateId: resolveId(
        row?.arrivedInCanadaTemplateId,
        process.env.KLAVIYO_ARRIVED_TEMPLATE_ID,
        DEFAULT_KLAVIYO_TEMPLATE_IDS.arrivedInCanada,
      ),
      thursdayTemplateId: resolveId(
        row?.thursdayTemplateId,
        process.env.KLAVIYO_THURSDAY_TEMPLATE_ID,
        DEFAULT_KLAVIYO_TEMPLATE_IDS.thursday,
      ),
    },
    preorderLabels: {
      pieceMade: resolveLabel(
        row?.pieceMadeLabel,
        DEFAULT_PREORDER_LABELS.pieceMade,
      ),
      leavingForCanada: resolveLabel(
        row?.leavingForCanadaLabel,
        DEFAULT_PREORDER_LABELS.leavingForCanada,
      ),
      arrivedInCanada: resolveLabel(
        row?.arrivedInCanadaLabel,
        DEFAULT_PREORDER_LABELS.arrivedInCanada,
      ),
      depositFulfilled: resolveLabel(
        row?.depositFulfilledLabel,
        DEFAULT_PREORDER_LABELS.depositFulfilled,
      ),
      depositFulfilledDone: resolveLabel(
        row?.depositFulfilledDoneLabel,
        DEFAULT_PREORDER_LABELS.depositFulfilledDone,
      ),
    },
    preorderTags: {
      pieceMadeTag: resolveTag(
        row?.pieceMadeTag,
        DEFAULT_PREORDER_TAGS.pieceMadeTag,
      ),
      leavingForCanadaTag: resolveTag(
        row?.leavingForCanadaTag,
        DEFAULT_PREORDER_TAGS.leavingForCanadaTag,
      ),
      arrivedInCanadaTag: resolveTag(
        row?.arrivedInCanadaTag,
        DEFAULT_PREORDER_TAGS.arrivedInCanadaTag,
      ),
      pieceMadeEmailSentTag: resolveTag(
        row?.pieceMadeEmailSentTag,
        DEFAULT_PREORDER_TAGS.pieceMadeEmailSentTag,
      ),
      leavingEmailSentTag: resolveTag(
        row?.leavingEmailSentTag,
        DEFAULT_PREORDER_TAGS.leavingEmailSentTag,
      ),
      arrivedEmailSentTag: resolveTag(
        row?.arrivedEmailSentTag,
        DEFAULT_PREORDER_TAGS.arrivedEmailSentTag,
      ),
    },
  };
}

export async function getKlaviyoTemplateIds(
  shop: string,
): Promise<KlaviyoTemplateIds> {
  const settings = await getShopSettings(shop);
  return settings.klaviyoTemplates;
}

export async function saveShopSettings(
  shop: string,
  input: ShopSettingsInput,
): Promise<void> {
  await prisma.shopKlaviyoSettings.upsert({
    where: { shop },
    create: {
      shop,
      pieceMadeTemplateId: trimOrEmpty(input.pieceMadeTemplateId),
      leavingForCanadaTemplateId: trimOrEmpty(
        input.leavingForCanadaTemplateId,
      ),
      arrivedInCanadaTemplateId: trimOrEmpty(input.arrivedInCanadaTemplateId),
      thursdayTemplateId: trimOrEmpty(input.thursdayTemplateId),
      pieceMadeLabel: trimOrEmpty(input.pieceMade),
      leavingForCanadaLabel: trimOrEmpty(input.leavingForCanada),
      arrivedInCanadaLabel: trimOrEmpty(input.arrivedInCanada),
      depositFulfilledLabel: trimOrEmpty(input.depositFulfilled),
      depositFulfilledDoneLabel: trimOrEmpty(input.depositFulfilledDone),
      pieceMadeTag: trimOrEmpty(input.pieceMadeTag),
      leavingForCanadaTag: trimOrEmpty(input.leavingForCanadaTag),
      arrivedInCanadaTag: trimOrEmpty(input.arrivedInCanadaTag),
      pieceMadeEmailSentTag: trimOrEmpty(input.pieceMadeEmailSentTag),
      leavingEmailSentTag: trimOrEmpty(input.leavingEmailSentTag),
      arrivedEmailSentTag: trimOrEmpty(input.arrivedEmailSentTag),
    },
    update: {
      pieceMadeTemplateId: trimOrEmpty(input.pieceMadeTemplateId),
      leavingForCanadaTemplateId: trimOrEmpty(
        input.leavingForCanadaTemplateId,
      ),
      arrivedInCanadaTemplateId: trimOrEmpty(input.arrivedInCanadaTemplateId),
      thursdayTemplateId: trimOrEmpty(input.thursdayTemplateId),
      pieceMadeLabel: trimOrEmpty(input.pieceMade),
      leavingForCanadaLabel: trimOrEmpty(input.leavingForCanada),
      arrivedInCanadaLabel: trimOrEmpty(input.arrivedInCanada),
      depositFulfilledLabel: trimOrEmpty(input.depositFulfilled),
      depositFulfilledDoneLabel: trimOrEmpty(input.depositFulfilledDone),
      pieceMadeTag: trimOrEmpty(input.pieceMadeTag),
      leavingForCanadaTag: trimOrEmpty(input.leavingForCanadaTag),
      arrivedInCanadaTag: trimOrEmpty(input.arrivedInCanadaTag),
      pieceMadeEmailSentTag: trimOrEmpty(input.pieceMadeEmailSentTag),
      leavingEmailSentTag: trimOrEmpty(input.leavingEmailSentTag),
      arrivedEmailSentTag: trimOrEmpty(input.arrivedEmailSentTag),
    },
  });
}

export function statusTagForAction(
  tags: PreorderWorkflowTags,
  action: StatusEmailAction,
): string {
  switch (action) {
    case "piece_made":
      return tags.pieceMadeTag;
    case "leaving_for_canada":
      return tags.leavingForCanadaTag;
    case "arrived_in_canada":
      return tags.arrivedInCanadaTag;
    default:
      return "";
  }
}

export function emailSentTagForAction(
  tags: PreorderWorkflowTags,
  action: StatusEmailAction,
): string {
  switch (action) {
    case "piece_made":
      return tags.pieceMadeEmailSentTag;
    case "leaving_for_canada":
      return tags.leavingEmailSentTag;
    case "arrived_in_canada":
      return tags.arrivedEmailSentTag;
    default:
      return "";
  }
}

export function templateIdForAction(
  ids: KlaviyoTemplateIds,
  action: StatusEmailAction,
): string {
  switch (action) {
    case "piece_made":
      return ids.pieceMadeTemplateId;
    case "leaving_for_canada":
      return ids.leavingForCanadaTemplateId;
    case "arrived_in_canada":
      return ids.arrivedInCanadaTemplateId;
    default:
      return "";
  }
}

/** @deprecated Use templateIdForAction */
export function templateIdForStatusTag(
  ids: KlaviyoTemplateIds,
  statusTag: string,
): string {
  if (statusTag === TAGS.PIECE_MADE) return ids.pieceMadeTemplateId;
  if (statusTag === TAGS.LEAVING_FOR_CANADA) {
    return ids.leavingForCanadaTemplateId;
  }
  if (statusTag === TAGS.ARRIVED_IN_CANADA) {
    return ids.arrivedInCanadaTemplateId;
  }
  return "";
}
