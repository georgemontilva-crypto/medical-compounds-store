import { useEffect, useState } from "react";
import { Link } from "wouter";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  DEFAULT_SHIPPING_SETTINGS,
  UPS_SERVICES,
  isOriginComplete,
  type ShippingSettings,
} from "@shared/shipping";
import { COUNTRIES } from "@shared/countries";
import { AlertTriangle, Check, Loader2, MapPin, Package, Truck } from "lucide-react";

export default function AdminShippingSettings() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.shipping.getSettings.useQuery();
  const [form, setForm] = useState<ShippingSettings>(DEFAULT_SHIPPING_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  // Seeded once. Re-syncing on every query result would wipe edits in progress
  // the moment anything refetched in the background.
  useEffect(() => {
    if (data && !loaded) {
      setForm(data.settings);
      setLoaded(true);
    }
  }, [data, loaded]);

  const save = trpc.shipping.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("Shipping settings saved");
      utils.shipping.getSettings.invalidate();
    },
    onError: (err) => toast.error(err.message || "Could not save shipping settings"),
  });

  const originComplete = isOriginComplete(form.origin);
  const anyService = UPS_SERVICES.some((s) => form.services[s.code]);
  const missingWeight = data?.productsMissingWeight ?? 0;

  const setOrigin = (field: keyof ShippingSettings["origin"], value: string) =>
    setForm((f) => ({ ...f, origin: { ...f.origin, [field]: value } }));

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <p className="lab-section-title mb-1">Configuration</p>
          <h1 className="text-2xl font-bold">Shipping</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Where parcels ship from, which UPS services to offer, and what to add for handling.
            Carrier credentials are set as environment variables, not here.
          </p>
        </div>

        <ReadinessPanel
          originComplete={originComplete}
          anyService={anyService}
          missingWeight={missingWeight}
          loading={isLoading}
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(form);
          }}
          className="space-y-6"
        >
          {/* Origin */}
          <section className="lab-card p-5">
            <div className="flex items-start gap-2 mb-4">
              <MapPin size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <h2 className="font-semibold">Ship-from address</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The origin UPS quotes from. Rates cannot be requested until every field is
                  filled.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Field
                label="Business name"
                value={form.origin.name}
                onChange={(v) => setOrigin("name", v)}
                placeholder="Brighter Days Labs"
              />
              <Field
                label="Street address"
                value={form.origin.street}
                onChange={(v) => setOrigin("street", v)}
                placeholder="400 Science Park Dr"
              />
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="City"
                  value={form.origin.city}
                  onChange={(v) => setOrigin("city", v)}
                  placeholder="Boston"
                />
                <Field
                  label="State / Province"
                  value={form.origin.state}
                  onChange={(v) => setOrigin("state", v)}
                  placeholder="MA"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="ZIP / Postal code"
                  value={form.origin.zip}
                  onChange={(v) => setOrigin("zip", v)}
                  placeholder="02115"
                />
                <div>
                  <label className="block text-sm font-medium mb-1.5">Country</label>
                  <select
                    className="lab-input"
                    value={form.origin.country}
                    onChange={(e) => setOrigin("country", e.target.value)}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          {/* Services */}
          <section className="lab-card p-5">
            <div className="flex items-start gap-2 mb-4">
              <Truck size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <h2 className="font-semibold">Services offered</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Only the services switched on here are quoted at checkout.
                </p>
              </div>
            </div>

            <ul className="divide-y divide-border">
              {UPS_SERVICES.map((service) => (
                <li key={service.code} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{service.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      Service code {service.code}
                    </p>
                  </div>
                  <Toggle
                    checked={Boolean(form.services[service.code])}
                    onChange={(next) =>
                      setForm((f) => ({
                        ...f,
                        services: { ...f.services, [service.code]: next },
                      }))
                    }
                    label={service.label}
                  />
                </li>
              ))}
            </ul>

            {!anyService && (
              <p className="text-xs text-amber-700 mt-3">
                With no service selected, checkout has nothing to quote.
              </p>
            )}
          </section>

          {/* Handling */}
          <section className="lab-card p-5">
            <div className="flex items-start gap-2 mb-4">
              <Package size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <h2 className="font-semibold">Handling fee</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Added to every carrier rate, for packing materials and labour. Set to 0 to pass
                  the carrier rate through unchanged.
                </p>
              </div>
            </div>

            <div className="relative w-40">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <input
                className="lab-input pl-7"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={form.handlingFeeUsd}
                onChange={(e) =>
                  setForm((f) => ({ ...f, handlingFeeUsd: Number(e.target.value) || 0 }))
                }
              />
            </div>
          </section>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={save.isPending || isLoading}
              className="lab-btn-primary px-6 py-2.5"
            >
              {save.isPending ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Saving…
                </>
              ) : (
                "Save settings"
              )}
            </button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}

/**
 * What still stands between this configuration and a working quote.
 *
 * Three separate things must all be true, and each fails silently on its own —
 * an incomplete origin, no service selected, or products with no weight. Saying
 * so here beats discovering it one failed checkout at a time.
 */
function ReadinessPanel({
  originComplete,
  anyService,
  missingWeight,
  loading,
}: {
  originComplete: boolean;
  anyService: boolean;
  missingWeight: number;
  loading: boolean;
}) {
  if (loading) {
    return <div className="h-20 rounded-2xl bg-secondary/60 animate-pulse" />;
  }

  const checks = [
    { ok: originComplete, label: "Ship-from address complete" },
    { ok: anyService, label: "At least one service offered" },
    {
      ok: missingWeight === 0,
      label:
        missingWeight === 0
          ? "Every active product has a shipping weight"
          : `${missingWeight} active product${missingWeight === 1 ? "" : "s"} without a weight`,
      href: missingWeight > 0 ? "/admin/products" : undefined,
    },
  ];

  const ready = checks.every((c) => c.ok);

  return (
    <div
      className={`lab-card p-4 border ${
        ready ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50"
      }`}
    >
      <div className="flex items-start gap-2 mb-3">
        {ready ? (
          <Check size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
        ) : (
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
        )}
        <p className="text-sm font-medium">
          {ready ? "Ready to quote shipping rates" : "Not ready to quote shipping rates yet"}
        </p>
      </div>
      <ul className="space-y-1.5 ml-6">
        {checks.map((check) => (
          <li key={check.label} className="flex items-center gap-2 text-sm">
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                check.ok ? "bg-green-600" : "bg-amber-600"
              }`}
            />
            {check.href ? (
              <Link href={check.href}>
                <span className="text-muted-foreground hover:text-foreground underline cursor-pointer">
                  {check.label}
                </span>
              </Link>
            ) : (
              <span className="text-muted-foreground">{check.label}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <input
        className="lab-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
        checked ? "bg-primary" : "bg-secondary border border-border"
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-[1.375rem]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
