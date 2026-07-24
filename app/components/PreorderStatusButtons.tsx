import { hasTag, TAGS } from "../lib/tags";
import type { ShippingOrder } from "../lib/orders.server";
import type { StatusAction } from "../lib/tags";

type Props = {
  order: ShippingOrder;
  busyAction: string | null;
  onAction: (orderId: string, action: StatusAction) => void;
};

function DoneBadge({ children }: { children: string }) {
  return (
    <s-badge tone="success" color="strong" icon="check-circle">
      {children}
    </s-badge>
  );
}

export function PreorderStatusButtons({ order, busyAction, onAction }: Props) {
  const { tags, id, isSkirtDeposit } = order;
  const busy = busyAction?.startsWith(id) ?? false;

  if (isSkirtDeposit) {
    const done = hasTag(tags, TAGS.DEPOSIT_FULFILLED);
    if (done) {
      return <DoneBadge>Deposit fulfilled</DoneBadge>;
    }
    return (
      <s-button
        variant="primary"
        disabled={busy}
        {...(busyAction === `${id}:deposit_fulfilled` ? { loading: true } : {})}
        onClick={() => onAction(id, "deposit_fulfilled")}
      >
        Mark Deposit Fulfilled
      </s-button>
    );
  }

  const pieceMade = hasTag(tags, TAGS.PIECE_MADE);
  const leaving = hasTag(tags, TAGS.LEAVING_FOR_CANADA);
  const arrived = hasTag(tags, TAGS.ARRIVED_IN_CANADA);

  return (
    <s-stack direction="inline" gap="small-200">
      {pieceMade ? (
        <DoneBadge>Piece Made</DoneBadge>
      ) : (
        <s-button
          variant="primary"
          disabled={busy}
          {...(busyAction === `${id}:piece_made` ? { loading: true } : {})}
          onClick={() => onAction(id, "piece_made")}
        >
          Piece Made
        </s-button>
      )}

      {leaving ? (
        <DoneBadge>Leaving for Canada</DoneBadge>
      ) : (
        <s-button
          variant="primary"
          disabled={!pieceMade || busy}
          {...(busyAction === `${id}:leaving_for_canada`
            ? { loading: true }
            : {})}
          onClick={() => onAction(id, "leaving_for_canada")}
        >
          Leaving for Canada
        </s-button>
      )}

      {arrived ? (
        <DoneBadge>Arrived in Canada</DoneBadge>
      ) : (
        <s-button
          variant="primary"
          disabled={!leaving || busy}
          {...(busyAction === `${id}:arrived_in_canada`
            ? { loading: true }
            : {})}
          onClick={() => onAction(id, "arrived_in_canada")}
        >
          Arrived in Canada
        </s-button>
      )}
    </s-stack>
  );
}
