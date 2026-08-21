import { useEffect, useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  DEFAULT_SHIPPING_SETTINGS,
  UPS_SERVICES,
  billableWeightLbs,
  dimensionalWeightLbs,
  shippingReadiness,
  type ShippingBox,
  type ShippingSettings,
} from "@shared/shipping";
import { COUNTRIES } from "@shared/countries";
import {
  AlertTriangle,
  Box,
  Check,
  Loader2,
  MapPin,
  Plus,
  Scale,
  Trash2,
  Truck,
} from "lucide-react";

const NEW_BOX: ShippingBox = {
  name: "",
  lengthIn: 6,
  widthIn: 4,
  heightIn: 3,
  maxUnits: 4,
  packagingWeightOz: null,
};

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
    onError: err =>
      toast.error(err.message || "Could not save shipping settings"),
  });

  // Computed from the form rather than the server response, so the checklist
  // reacts as things are typed instead of only after a save.
  const readiness = shippingReadiness(form);

  const setOrigin = (field: keyof ShippingSettings["origin"], value: string) =>
    setForm(f => ({ ...f, origin: { ...f.origin, [field]: value } }));

  const setBox = (index: number, patch: Partial<ShippingBox>) =>
    setForm(f => ({
      ...f,
      boxes: f.boxes.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }));

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        <div>
          <p className="lab-section-title mb-1">Configuration</p>
          <h1 className="text-2xl font-bold">Shipping</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Where parcels ship from, what they weigh, which boxes they go in,
            and which UPS services to offer. Carrier credentials are set as
            environment variables, not here.
          </p>
        </div>

        <ReadinessPanel readiness={readiness} loading={isLoading} />

        <form
          onSubmit={e => {
            e.preventDefault();
            save.mutate(form);
          }}
          className="space-y-6"
        >
          <div className="grid lg:grid-cols-2 gap-6 items-start">
            {/* Origin */}
            <section className="lab-card p-5">
              <SectionHeader
                icon={MapPin}
                title="Ship-from address"
                note="The origin UPS quotes from. Rates cannot be requested until every field is filled."
              />
              <div className="space-y-4">
                <Field
                  label="Business name"
                  value={form.origin.name}
                  onChange={v => setOrigin("name", v)}
                  placeholder="Brighter Days Labs"
                />
                <Field
                  label="Street address"
                  value={form.origin.street}
                  onChange={v => setOrigin("street", v)}
                  placeholder="400 Science Park Dr"
                />
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="City"
                    value={form.origin.city}
                    onChange={v => setOrigin("city", v)}
                    placeholder="Boston"
                  />
                  <Field
                    label="State / Province"
                    value={form.origin.state}
                    onChange={v => setOrigin("state", v)}
                    placeholder="MA"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field
                    label="ZIP / Postal code"
                    value={form.origin.zip}
                    onChange={v => setOrigin("zip", v)}
                    placeholder="02115"
                  />
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      Country
                    </label>
                    <select
                      className="lab-input"
                      value={form.origin.country}
                      onChange={e => setOrigin("country", e.target.value)}
                    >
                      {COUNTRIES.map(c => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </section>

            <div className="space-y-6">
              {/* Weights */}
              <section className="lab-card p-5">
                <SectionHeader
                  icon={Scale}
                  title="Default weights"
                  note="What a standard vial weighs, and what the packaging adds. Products only record a weight of their own when they genuinely differ."
                />
                <div className="grid sm:grid-cols-2 gap-4">
                  <NumberField
                    label="Standard vial weight"
                    suffix="oz"
                    value={form.defaultVialWeightOz}
                    onChange={v =>
                      setForm(f => ({ ...f, defaultVialWeightOz: v }))
                    }
                    help="Used for every product without its own weight."
                    min={0.01}
                  />
                  <NumberField
                    label="Packaging weight"
                    suffix="oz"
                    value={form.packagingWeightOz}
                    onChange={v =>
                      setForm(f => ({ ...f, packagingWeightOz: v }))
                    }
                    help="Added once per order. A box may override it below."
                    min={0}
                  />
                </div>
              </section>

              {/* Services */}
              <section className="lab-card p-5">
                <SectionHeader
                  icon={Truck}
                  title="Services offered"
                  note="Only the services switched on here are quoted at checkout."
                />
                <ul className="divide-y divide-border">
                  {UPS_SERVICES.map(service => (
                    <li
                      key={service.code}
                      className="flex items-center justify-between gap-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{service.label}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          Service code {service.code}
                        </p>
                      </div>
                      <Toggle
                        checked={Boolean(form.services[service.code])}
                        onChange={next =>
                          setForm(f => ({
                            ...f,
                            services: { ...f.services, [service.code]: next },
                          }))
                        }
                        label={service.label}
                      />
                    </li>
                  ))}
                </ul>
                {!readiness.anyService && (
                  <p className="text-xs text-amber-700 mt-3">
                    With no service selected, checkout has nothing to quote.
                  </p>
                )}
              </section>

              {/* Handling */}
              <section className="lab-card p-5">
                <SectionHeader
                  icon={Scale}
                  title="Handling fee"
                  note="Added to every carrier rate, for labour. Set to 0 to pass the carrier rate through unchanged."
                />
                <NumberField
                  label="Handling fee"
                  prefix="$"
                  value={form.handlingFeeUsd}
                  onChange={v => setForm(f => ({ ...f, handlingFeeUsd: v }))}
                  min={0}
                  max={100}
                  className="w-40"
                />
              </section>
            </div>
          </div>

          {/* Boxes */}
          <section className="lab-card p-5">
            <SectionHeader
              icon={Box}
              title="Shipping boxes"
              note="An order goes in the smallest box that holds its units. Capacity is a count of units, not a weight — vials are light enough that the box, not the contents, decides the rate."
            />

            {form.boxes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No boxes defined yet. At least one is needed before rates can be
                quoted.
              </p>
            ) : (
              <ul className="space-y-4">
                {form.boxes.map((box, i) => (
                  <BoxRow
                    key={i}
                    box={box}
                    vialWeightOz={form.defaultVialWeightOz}
                    fallbackPackagingOz={form.packagingWeightOz}
                    onChange={patch => setBox(i, patch)}
                    onRemove={() =>
                      setForm(f => ({
                        ...f,
                        boxes: f.boxes.filter((_, j) => j !== i),
                      }))
                    }
                  />
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={() =>
                setForm(f => ({ ...f, boxes: [...f.boxes, { ...NEW_BOX }] }))
              }
              className="lab-btn-secondary mt-4 py-2 px-4 text-sm"
            >
              <Plus size={14} />
              Add box
            </button>
          </section>

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
        </form>
      </div>
    </AdminLayout>
  );
}

/**
 * One configured box, with the cost consequence of its size shown alongside.
 *
 * The dimensional figure is the point of this row. UPS bills the greater of real
 * and dimensional weight, and for a parcel of vials the dimensional figure wins
 * almost every time — so a carton chosen for convenience quietly triples the
 * rate. Putting the number next to the inputs makes that visible while the box
 * is being defined rather than a month later on an invoice.
 */
function BoxRow({
  box,
  vialWeightOz,
  fallbackPackagingOz,
  onChange,
  onRemove,
}: {
  box: ShippingBox;
  vialWeightOz: number;
  fallbackPackagingOz: number;
  onChange: (patch: Partial<ShippingBox>) => void;
  onRemove: () => void;
}) {
  const packagingOz = box.packagingWeightOz ?? fallbackPackagingOz;
  // A full box: the heaviest this one legitimately carries.
  const fullOz = vialWeightOz * box.maxUnits + packagingOz;
  const dimLbs = dimensionalWeightLbs(box);
  const billableLbs = billableWeightLbs(fullOz, box);
  const dimensionDominates = dimLbs > fullOz / 16;

  return (
    <li className="rounded-xl border border-border p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <input
          className="lab-input py-1.5 text-sm max-w-xs"
          value={box.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder="Standard box"
          aria-label="Box name"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${box.name || "box"}`}
          className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors flex-shrink-0"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs text-muted-foreground mb-1">
            Dimensions (L × W × H, inches)
          </label>
          <div className="flex items-center gap-2">
            {(["lengthIn", "widthIn", "heightIn"] as const).map((key, i) => (
              <div key={key} className="flex items-center gap-2 min-w-0">
                {i > 0 && (
                  <span className="text-muted-foreground text-sm">×</span>
                )}
                <input
                  className="lab-input py-1.5 text-sm min-w-0"
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={box[key]}
                  onChange={e =>
                    onChange({ [key]: Number(e.target.value) || 0 })
                  }
                  aria-label={`${["Length", "Width", "Height"][i]} in inches`}
                />
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            Holds up to
          </label>
          <div className="relative">
            <input
              className="lab-input py-1.5 text-sm pr-12"
              type="number"
              min="1"
              step="1"
              value={box.maxUnits}
              onChange={e =>
                onChange({ maxUnits: Math.max(1, Number(e.target.value) || 1) })
              }
              aria-label="Maximum units this box holds"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              units
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-xs text-muted-foreground mb-1">
          Packaging weight override
        </label>
        <div className="relative w-40">
          <input
            className="lab-input py-1.5 text-sm pr-10"
            type="number"
            step="0.1"
            min="0"
            value={box.packagingWeightOz ?? ""}
            onChange={e =>
              onChange({
                packagingWeightOz:
                  e.target.value === "" ? null : Number(e.target.value),
              })
            }
            placeholder={String(fallbackPackagingOz)}
            aria-label="Packaging weight override in ounces"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            oz
          </span>
        </div>
      </div>

      <div
        className={`mt-3 pt-3 border-t border-border text-xs ${
          dimensionDominates ? "text-amber-700" : "text-muted-foreground"
        }`}
      >
        <span className="font-mono">
          DIM {dimLbs.toFixed(2)} lb · full box {(fullOz / 16).toFixed(2)} lb ·
          UPS bills {billableLbs} lb
        </span>
        {dimensionDominates && (
          <p className="mt-1">
            This box is rated on its size, not its contents — UPS bills{" "}
            {billableLbs} lb however little is inside. A smaller box costs less
            for the same order.
          </p>
        )}
      </div>
    </li>
  );
}

function ReadinessPanel({
  readiness,
  loading,
}: {
  readiness: ReturnType<typeof shippingReadiness>;
  loading: boolean;
}) {
  if (loading) {
    return <div className="h-24 rounded-2xl bg-secondary/60 animate-pulse" />;
  }

  const checks = [
    { ok: readiness.originComplete, label: "Ship-from address complete" },
    { ok: readiness.anyService, label: "At least one service offered" },
    { ok: readiness.anyBox, label: "At least one shipping box defined" },
    { ok: readiness.vialWeightSet, label: "Standard vial weight set" },
  ];

  const ready = checks.every(c => c.ok);

  return (
    <div
      className={`lab-card p-4 border ${
        ready
          ? "border-green-200 bg-green-50/50"
          : "border-amber-200 bg-amber-50/50"
      }`}
    >
      <div className="flex items-start gap-2 mb-3">
        {ready ? (
          <Check size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
        ) : (
          <AlertTriangle
            size={16}
            className="text-amber-600 mt-0.5 flex-shrink-0"
          />
        )}
        <p className="text-sm font-medium">
          {ready
            ? "Ready to quote shipping rates"
            : "Not ready to quote shipping rates yet"}
        </p>
      </div>
      <ul className="space-y-1.5 ml-6">
        {checks.map(check => (
          <li key={check.label} className="flex items-center gap-2 text-sm">
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                check.ok ? "bg-green-600" : "bg-amber-600"
              }`}
            />
            <span className="text-muted-foreground">{check.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  note,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  note: string;
}) {
  return (
    <div className="flex items-start gap-2 mb-4">
      <Icon size={16} className="text-muted-foreground mt-0.5 flex-shrink-0" />
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-prose">
          {note}
        </p>
      </div>
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
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  help,
  prefix,
  suffix,
  min,
  max,
  className = "",
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  help?: string;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  className?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <div className={`relative ${className}`}>
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <input
          className={`lab-input ${prefix ? "pl-7" : ""} ${suffix ? "pr-10" : ""}`}
          type="number"
          step="0.1"
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(Number(e.target.value) || 0)}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {help && <p className="text-xs text-muted-foreground mt-1">{help}</p>}
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
