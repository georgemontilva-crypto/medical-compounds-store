import { useState } from "react";
import Navbar from "@/components/Navbar";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CreditCard, Percent, Package, UserCheck, Send, Check } from "lucide-react";

const BENEFITS = [
  { icon: CreditCard, title: "Flexible payment", description: "Net terms and purchase orders for qualified accounts." },
  { icon: Percent, title: "Custom pricing rules", description: "Tiered discounts scaled to your monthly volume." },
  { icon: Package, title: "Volume SKUs", description: "Bulk vial counts and multi-pack sizing on request." },
  { icon: UserCheck, title: "Dedicated rep", description: "A single point of contact for orders and COAs." },
];

const RESEARCH_DOMAINS = [
  { value: "tissue_repair", label: "Tissue Repair" },
  { value: "cellular", label: "Cellular" },
  { value: "neural", label: "Neural" },
  { value: "metabolic", label: "Metabolic" },
  { value: "endocrine", label: "Endocrine" },
];

const VOLUME_OPTIONS = [
  { value: "under_1000", label: "Under $1,000", detail: "per month" },
  { value: "1000_5000", label: "$1,000 – $5,000", detail: "per month" },
  { value: "5000_25000", label: "$5,000 – $25,000", detail: "per month" },
  { value: "25000_plus", label: "$25,000+", detail: "per month" },
];

const inputCls =
  "w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7ECDC4]/40 focus:border-[#7ECDC4] transition";
const labelCls = "block text-xs font-semibold text-gray-500 tracking-widest uppercase mb-1.5";

type FormState = {
  fullName: string;
  workEmail: string;
  phone: string;
  roleTitle: string;
  organization: string;
  researchDomains: string[];
  expectedMonthlyVolume: string;
  taxExempt: boolean;
  shippingStreet: string;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
  notes: string;
  wantsUpdates: boolean;
};

const emptyForm: FormState = {
  fullName: "",
  workEmail: "",
  phone: "",
  roleTitle: "",
  organization: "",
  researchDomains: [],
  expectedMonthlyVolume: "",
  taxExempt: false,
  shippingStreet: "",
  shippingCity: "",
  shippingState: "",
  shippingZip: "",
  notes: "",
  wantsUpdates: false,
};

export default function WholesaleApplication() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitted, setSubmitted] = useState(false);

  const createMutation = trpc.wholesaleApplications.create.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => toast.error(err.message || "Something went wrong. Please try again."),
  });

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleDomain(value: string) {
    setForm((f) => ({
      ...f,
      researchDomains: f.researchDomains.includes(value)
        ? f.researchDomains.filter((d) => d !== value)
        : [...f.researchDomains, value],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (
      !form.fullName ||
      !form.workEmail ||
      !form.phone ||
      !form.roleTitle ||
      !form.organization ||
      !form.expectedMonthlyVolume ||
      !form.shippingStreet ||
      !form.shippingCity ||
      !form.shippingState ||
      !form.shippingZip
    ) {
      toast.error("Please fill in all required fields.");
      return;
    }
    createMutation.mutate({
      fullName: form.fullName,
      workEmail: form.workEmail,
      phone: form.phone,
      roleTitle: form.roleTitle,
      organization: form.organization,
      researchDomains: form.researchDomains,
      expectedMonthlyVolume: form.expectedMonthlyVolume as "under_1000" | "1000_5000" | "5000_25000" | "25000_plus",
      taxExempt: form.taxExempt,
      shippingStreet: form.shippingStreet,
      shippingCity: form.shippingCity,
      shippingState: form.shippingState,
      shippingZip: form.shippingZip,
      notes: form.notes || undefined,
      wantsUpdates: form.wantsUpdates,
    });
  }

  return (
    <div className="min-h-screen bg-[#f8f8fa]">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs font-semibold tracking-widest uppercase text-[#3A9E94] mb-3">Wholesale Application</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-950 mb-4">
            Built for institutional research at volume
          </h1>
          <p className="text-gray-500 text-base max-w-xl mx-auto leading-relaxed">
            Brighter Days Labs partners with universities, contract labs, and research organizations that need
            consistent supply, documentation, and pricing at scale. Tell us about your program and our team will
            follow up.
          </p>
        </div>

        {/* Benefit cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {BENEFITS.map((b) => (
            <div key={b.title} className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl bg-[#E8F7F6] flex items-center justify-center mb-3">
                <b.icon size={17} className="text-[#3A9E94]" />
              </div>
              <p className="font-bold text-gray-900 text-sm mb-1">{b.title}</p>
              <p className="text-gray-500 text-xs leading-relaxed">{b.description}</p>
            </div>
          ))}
        </div>

        {/* Form */}
        {submitted ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[#E8F7F6] flex items-center justify-center mx-auto mb-4">
              <Check size={24} className="text-[#3A9E94]" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Application received</h2>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              Thanks, {form.fullName}. Our team is reviewing your application and will follow up at{" "}
              <span className="font-semibold text-gray-700">{form.workEmail}</span> within 1-2 business days.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-10 space-y-10">
            {/* About You */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400 mb-4">About You</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Full name <span className="text-[#3A9E94]">*</span></label>
                  <input className={inputCls} value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Dr. Jane Smith" />
                </div>
                <div>
                  <label className={labelCls}>Work email <span className="text-[#3A9E94]">*</span></label>
                  <input type="email" className={inputCls} value={form.workEmail} onChange={(e) => set("workEmail", e.target.value)} placeholder="jane@research-lab.edu" />
                </div>
                <div>
                  <label className={labelCls}>Phone <span className="text-[#3A9E94]">*</span></label>
                  <input type="tel" className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(555) 555-5555" />
                </div>
                <div>
                  <label className={labelCls}>Role / title <span className="text-[#3A9E94]">*</span></label>
                  <input className={inputCls} value={form.roleTitle} onChange={(e) => set("roleTitle", e.target.value)} placeholder="Lab Manager" />
                </div>
              </div>
            </div>

            {/* Your Research */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400 mb-4">Your Research</h2>
              <div className="mb-4">
                <label className={labelCls}>Organization <span className="text-[#3A9E94]">*</span></label>
                <input className={inputCls} value={form.organization} onChange={(e) => set("organization", e.target.value)} placeholder="University / Lab / Company" />
              </div>

              <div className="mb-4">
                <label className={labelCls}>Research domains</label>
                <div className="flex flex-wrap gap-2">
                  {RESEARCH_DOMAINS.map((d) => {
                    const active = form.researchDomains.includes(d.value);
                    return (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => toggleDomain(d.value)}
                        className={`text-xs font-semibold px-4 py-2 rounded-full border transition-colors ${
                          active
                            ? "bg-[#3A9E94] border-[#3A9E94] text-white"
                            : "bg-white border-gray-200 text-gray-600 hover:border-[#7ECDC4]"
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-4">
                <label className={labelCls}>Expected monthly volume <span className="text-[#3A9E94]">*</span></label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {VOLUME_OPTIONS.map((v) => {
                    const active = form.expectedMonthlyVolume === v.value;
                    return (
                      <button
                        key={v.value}
                        type="button"
                        onClick={() => set("expectedMonthlyVolume", v.value)}
                        className={`text-left rounded-xl border px-4 py-3 transition-colors ${
                          active ? "border-[#3A9E94] bg-[#E8F7F6]" : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <p className={`text-sm font-bold ${active ? "text-[#2A8E84]" : "text-gray-900"}`}>{v.label}</p>
                        <p className="text-[11px] text-gray-400">{v.detail}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.taxExempt}
                  onChange={(e) => set("taxExempt", e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#3A9E94] focus:ring-[#7ECDC4]"
                />
                <span className="text-sm text-gray-600">My organization is tax-exempt</span>
              </label>
            </div>

            {/* Shipping Address */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400 mb-4">Shipping Address</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelCls}>Street address <span className="text-[#3A9E94]">*</span></label>
                  <input className={inputCls} value={form.shippingStreet} onChange={(e) => set("shippingStreet", e.target.value)} placeholder="123 Lab Way" />
                </div>
                <div>
                  <label className={labelCls}>City <span className="text-[#3A9E94]">*</span></label>
                  <input className={inputCls} value={form.shippingCity} onChange={(e) => set("shippingCity", e.target.value)} placeholder="Boston" />
                </div>
                <div>
                  <label className={labelCls}>State <span className="text-[#3A9E94]">*</span></label>
                  <input className={inputCls} value={form.shippingState} onChange={(e) => set("shippingState", e.target.value)} placeholder="MA" />
                </div>
                <div>
                  <label className={labelCls}>ZIP code <span className="text-[#3A9E94]">*</span></label>
                  <input className={inputCls} value={form.shippingZip} onChange={(e) => set("shippingZip", e.target.value)} placeholder="02110" />
                </div>
              </div>
            </div>

            {/* Anything Else */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400 mb-4">Anything Else?</h2>
              <textarea
                className={`${inputCls} resize-none`}
                rows={4}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                placeholder="Tell us more about your research program or specific needs..."
              />
            </div>

            {/* Stay in the Loop */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400 mb-4">Stay in the Loop</h2>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.wantsUpdates}
                  onChange={(e) => set("wantsUpdates", e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#3A9E94] focus:ring-[#7ECDC4]"
                />
                <span className="text-sm text-gray-600">
                  Send me occasional updates on new compounds, pricing, and lab reports
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 bg-[#3A9E94] hover:bg-[#2A8E84] disabled:opacity-60 text-white font-semibold text-sm px-7 py-3.5 rounded-full transition-all active:scale-[0.97]"
            >
              {createMutation.isPending ? "Submitting..." : "Submit application"}
              <Send size={15} />
            </button>
          </form>
        )}

        {/* Legal disclaimer */}
        <p className="text-[11px] text-gray-400 text-center leading-relaxed mt-8 max-w-2xl mx-auto">
          For Research Use Only. Not for Human Consumption. Submitting this application does not create an account
          or place an order — it requests review for wholesale-tier access.
        </p>
      </main>
    </div>
  );
}
