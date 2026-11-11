import { AlertTriangle, XCircle } from "lucide-react";
import type { AvailabilityState } from "@shared/availability";

/**
 * Says something only when there is something to say.
 *
 * "In stock" renders nothing. A shop that labels every available product as
 * available teaches shoppers to skip the label, and then the one that matters
 * goes unread too. Silence is the signal that nothing is wrong.
 */
export default function AvailabilityPill({
  state,
  size = "sm",
}: {
  state: AvailabilityState;
  size?: "sm" | "md";
}) {
  if (state === "in_stock") return null;

  const low = state === "low_stock";
  const Icon = low ? AlertTriangle : XCircle;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap ${
        size === "md" ? "px-3 py-1 text-xs" : "px-2 py-0.5 text-[11px]"
      } ${
        low
          ? "bg-amber-50 text-amber-800 border-amber-200"
          : "bg-gray-100 text-gray-600 border-gray-200"
      }`}
    >
      <Icon size={size === "md" ? 13 : 11} className="flex-shrink-0" />
      {low ? "Low stock" : "Unavailable"}
    </span>
  );
}
