import { AlertTriangle, Check, XCircle } from "lucide-react";
import type { AvailabilityState } from "@shared/availability";

/**
 * Says something only when there is something to say.
 *
 * "unknown" renders nothing, because nothing is known: that is a product whose
 * stock has never been entered, and a badge there would be a claim the shop
 * has not made. Every other state is a claim the shop has made, including the
 * reassuring one.
 */
export default function AvailabilityPill({
  state,
  size = "sm",
}: {
  state: AvailabilityState;
  size?: "sm" | "md";
}) {
  if (state === "unknown") return null;

  const tone =
    state === "in_stock"
      ? "bg-green-50 text-green-700 border-green-200"
      : state === "low_stock"
      ? "bg-amber-50 text-amber-800 border-amber-200"
      : "bg-gray-100 text-gray-600 border-gray-200";

  const Icon = state === "in_stock" ? Check : state === "low_stock" ? AlertTriangle : XCircle;
  const label =
    state === "in_stock"
      ? "In stock"
      : state === "low_stock"
      ? "Only a few left"
      : "Unavailable";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap ${
        size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[11px]"
      } ${tone}`}
    >
      <Icon size={size === "md" ? 13 : 11} className="flex-shrink-0" />
      {label}
    </span>
  );
}
