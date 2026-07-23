import type { ShippingOrder } from "../lib/orders.server";

type Props = {
  order: ShippingOrder;
  busy: boolean;
  onHold: (orderId: string) => void;
};

export function ShippingPaidAlert({ order, busy, onHold }: Props) {
  return (
    <s-banner
      heading={`${order.name} — new item after shipping was paid`}
      tone="warning"
    >
      <s-paragraph>
        {order.customerName || order.email || "Customer"} bought a new item
        after shipping was already paid. Ship now (manual) or hold for next
        Thursday?
      </s-paragraph>
      <s-stack direction="inline" gap="small-200">
        <s-button variant="secondary" disabled>
          Ship now (manual)
        </s-button>
        <s-button
          variant="primary"
          disabled={busy}
          {...(busy ? { loading: true } : {})}
          onClick={() => onHold(order.id)}
        >
          Hold for next cycle
        </s-button>
      </s-stack>
    </s-banner>
  );
}
