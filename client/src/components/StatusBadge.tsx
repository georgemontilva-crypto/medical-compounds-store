import type { StatusTone } from "@shared/orderStatus";
import { fulfillmentView, paymentView } from "@shared/orderStatus";
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Package,
  RotateCcw,
  XCircle,
} from "lucide-react";

/**
 * The one place a tone becomes a colour.
 *
 * Payment and fulfillment are read side by side, so the two must never be able
 * to collide on the same colour for the same order — shared/orderStatus.ts
 * keeps the labels apart and these keep the colours apart, by never giving an
 * unpaid order anything but grey on the fulfillment side.
 */
const TONE_CLASSES: Record<StatusTone, string> = {
  positive: "bg-green-100 text-green-700 border-green-200",
  attention: "bg-amber-100 text-amber-800 border-amber-200",
  critical: "bg-red-100 text-red-700 border-red-200",
  info: "bg-blue-100 text-blue-700 border-blue-200",
  neutral: "bg-gray-100 text-gray-600 border-gray-200",
};

function Badge({
  tone,
  icon: Icon,
  children,
}: {
  tone: StatusTone;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold whitespace-nowrap ${TONE_CLASSES[tone]}`}
    >
      <Icon size={12} className="flex-shrink-0" />
      {children}
    </span>
  );
}

const PAYMENT_ICONS = {
  paid: CheckCircle,
  awaiting: Clock,
  failed: AlertCircle,
  refunded: RotateCcw,
  "unpaid-closed": XCircle,
} as const;

/**
 * Whether this order's money has arrived.
 *
 * `audience` picks the wording: the shop reads "Paid", the buyer reads
 * "Payment received", because one is a fact about an order and the other is a
 * fact about the reader's own card.
 */
export function PaymentBadge({
  order,
  audience = "customer",
}: {
  order: { paymentStatus: string; status: string };
  audience?: "admin" | "customer";
}) {
  const view = paymentView(order);
  return (
    <Badge tone={view.tone} icon={PAYMENT_ICONS[view.key]}>
      {audience === "admin" ? view.adminLabel : view.customerLabel}
    </Badge>
  );
}

const FULFILLMENT_ICONS: Record<string, React.ElementType> = {
  Delivered: CheckCircle,
  Cancelled: XCircle,
  "On hold": Clock,
  "Not started": Clock,
};

/** How far along the parcel is. Grey and held until the order is paid. */
export function FulfillmentBadge({
  order,
}: {
  order: { paymentStatus: string; status: string };
}) {
  const view = fulfillmentView(order);
  return (
    <Badge tone={view.tone} icon={FULFILLMENT_ICONS[view.label] ?? Package}>
      {view.label}
    </Badge>
  );
}
