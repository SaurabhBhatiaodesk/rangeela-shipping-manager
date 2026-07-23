import { hasTag, TAGS } from "../lib/tags";
import type { ShippingOrder } from "../lib/orders.server";
import type { StatusAction } from "../lib/tags";

type Props = {
  order: ShippingOrder;
  busyAction: string | null;
  onAction: (orderId: string, action: StatusAction) => void;
};

export function PreorderStatusButtons({ order, busyAction, onAction }: Props) {
  const { tags, id, isSkirtDeposit } = order;
  const busy = busyAction?.startsWith(id) ?? false;

  if (isSkirtDeposit) {
    const done = hasTag(tags, TAGS.DEPOSIT_FULFILLED);
    return (
      <s-button
        variant="primary"
        disabled={done || busy}
        {...(busyAction === `${id}:deposit_fulfilled` ? { loading: true } : {})}
        onClick={() => onAction(id, "deposit_fulfilled")}
      >
        {done ? "Deposit fulfilled ✓" : "Mark Deposit Fulfilled"}
      </s-button>
    );
  }

  const pieceMade = hasTag(tags, TAGS.PIECE_MADE);
  const leaving = hasTag(tags, TAGS.LEAVING_FOR_CANADA);
  const arrived = hasTag(tags, TAGS.ARRIVED_IN_CANADA);

  return (
    <s-stack direction="inline" gap="small-200">
      <s-button
        variant={pieceMade ? "secondary" : "primary"}
        disabled={pieceMade || busy}
        {...(busyAction === `${id}:piece_made` ? { loading: true } : {})}
        onClick={() => onAction(id, "piece_made")}
      >
        {pieceMade ? "Piece Made ✓" : "Piece Made"}
      </s-button>

      <s-button
        variant={leaving ? "secondary" : "primary"}
        disabled={!pieceMade || leaving || busy}
        {...(busyAction === `${id}:leaving_for_canada` ? { loading: true } : {})}
        onClick={() => onAction(id, "leaving_for_canada")}
      >
        {leaving ? "Leaving for Canada ✓" : "Leaving for Canada"}
      </s-button>

      <s-button
        variant={arrived ? "secondary" : "primary"}
        disabled={!leaving || arrived || busy}
        {...(busyAction === `${id}:arrived_in_canada` ? { loading: true } : {})}
        onClick={() => onAction(id, "arrived_in_canada")}
      >
        {arrived ? "Arrived in Canada ✓" : "Arrived in Canada"}
      </s-button>
    </s-stack>
  );
}
