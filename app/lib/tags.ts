/** Order tags used by Rangeela Shipping Manager */

export const TAGS = {
  PIECE_MADE: "piece-made-notified",
  LEAVING_FOR_CANADA: "leaving-for-canada-notified",
  ARRIVED_IN_CANADA: "arrived-in-canada-notified",
  READY_TO_SHIP: "ready-to-ship",

  PIECE_MADE_EMAIL_SENT: "piece-made-email-sent",
  LEAVING_EMAIL_SENT: "leaving-email-sent",
  ARRIVED_EMAIL_SENT: "arrived-email-sent",

  GROUP: "group",
  PARTIAL: "partial",
  DEPOSIT_FULFILLED: "deposit-fulfilled",

  THURSDAY_EMAIL_SENT: "thursday-email-sent",
  SHIPPING_PAID: "shipping-paid",
  HOLD_FOR_NEXT_CYCLE: "hold-for-next-cycle",
  PUSHED_TO_NEXT_WEEKEND: "pushed-to-next-weekend",
} as const;

export type StatusAction =
  | "piece_made"
  | "leaving_for_canada"
  | "arrived_in_canada"
  | "deposit_fulfilled"
  | "hold_for_next_cycle";

/**
 * Klaviyo no longer supports POST /api/messages/send/ (returns 404).
 * App creates a metric event; a Klaviyo Flow (triggered by that metric)
 * sends the email that uses the template ID below.
 */
export const KLAVIYO_TEMPLATES = {
  [TAGS.PIECE_MADE]: {
    templateId: "WMcvs7",
    metricName: "Rangeela Piece Made",
    subject: "The saree you chose is now your dress!",
    sentTag: TAGS.PIECE_MADE_EMAIL_SENT,
  },
  [TAGS.LEAVING_FOR_CANADA]: {
    templateId: "TB2w7d",
    metricName: "Rangeela Leaving for Canada",
    subject: "Guess who's flying to Canada? Your Rangeelaa piece!",
    sentTag: TAGS.LEAVING_EMAIL_SENT,
  },
  [TAGS.ARRIVED_IN_CANADA]: {
    templateId: "XmXMMJ",
    metricName: "Rangeela Arrived in Canada",
    subject: "Guess what just landed in Canada?",
    sentTag: TAGS.ARRIVED_EMAIL_SENT,
  },
} as const;

/** Metric that triggers the Thursday combined shipping invoice flow */
export const KLAVIYO_THURSDAY_METRIC =
  "Rangeela Thursday Shipping Invoice";

export function hasTag(tags: string[], tag: string): boolean {
  return tags.some((t) => t.toLowerCase() === tag.toLowerCase());
}

export function isSkirtDeposit(tags: string[]): boolean {
  return hasTag(tags, TAGS.GROUP) && hasTag(tags, TAGS.PARTIAL);
}

export function normalizeTags(tags: string[] | string | null | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}
