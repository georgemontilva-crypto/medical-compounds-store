import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Product variation "value" columns are MySQL decimals, which come back as
// strings like "10.00" — Number(...).toString() drops insignificant
// trailing zeros ("10.00" -> "10") while still showing real decimals
// ("2.50" -> "2.5") correctly.
export function formatVariationValue(value: string | number): string {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toString();
}
