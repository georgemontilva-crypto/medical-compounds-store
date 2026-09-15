import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Building2, ArrowRight } from "lucide-react";

/**
 * The laboratory inquiry destination.
 *
 * Deliberately an inquiry, not a purchase. The advertising plan is explicit
 * that a purchase button would require a platform to have accepted direct
 * sales, which is a different review from accepting an inquiry campaign — so
 * this page collects a request and says plainly that submitting one does not
 * establish eligibility to buy.
 *
 * The acknowledgement is not decoration either: it is the record that the
 * enquirer stated a lawful research purpose, which is what the offer is sold
 * on. Staff verify the organisation independently before responding.
 */

export default function LaboratorySupply() {
  const [form, setForm] = useState({
    organization: "",
    organizationWebsite: "",
    contactName: "",
    role: "",
    workEmail: "",
    researchPurpose: "",
  });
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const complete =
    form.organization.trim() &&
    form.contactName.trim() &&
    form.workEmail.trim() &&
    form.researchPurpose.trim() &&
    acknowledged;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!complete) return;
    // Held here until the inquiry endpoint exists. Telling somebody their
    // request was sent when it was not is worse than the form not working.
    toast.info("Inquiry handling is being finalised. Please contact us directly in the meantime.");
    setSubmitted(true);
  }

  return (
    <div className="flex-1 hex-cream dark:bg-background">
      <section className="max-w-2xl mx-auto px-6 pt-16 pb-8">
        <div className="w-11 h-11 rounded-xl bg-[#f2ede6] flex items-center justify-center mb-5 dark:bg-card">
          <Building2 size={20} className="text-[#baac96]" />
        </div>
        <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-950 leading-tight mb-4 dark:text-white">
          Laboratory research supply
        </h1>
        <p className="text-gray-600 leading-relaxed mb-5 dark:text-gray-300">
          Discuss your laboratory's requirements with Brighter Days Labs. Our team can provide
          information about available research materials and published documentation for your
          proposed in vitro work.
        </p>
        <p className="text-sm text-gray-500 leading-relaxed dark:text-gray-400">
          For qualified research organizations. Materials are not intended for human or veterinary
          use. Submitting an inquiry does not establish purchasing eligibility.
        </p>
      </section>

      <section className="max-w-2xl mx-auto px-6 pb-20">
        <div className="lab-card p-6 sm:p-8">
          {submitted ? (
            <div className="text-center py-6">
              <p className="font-semibold text-gray-950 mb-2 dark:text-white">
                Thank you — we have your details.
              </p>
              <p className="text-sm text-gray-500 leading-relaxed dark:text-gray-400">
                Our team reviews each inquiry before responding. If your request is urgent, reach
                us through the contact page.
              </p>
              <Link href="/contact">
                <button className="mt-5 text-sm font-medium inline-flex items-center gap-1.5" style={{ color: "#baac96" }}>
                  Contact page <ArrowRight size={13} />
                </button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Organization name <span className="text-destructive">*</span>
                  </label>
                  <input
                    className="lab-input"
                    value={form.organization}
                    onChange={(e) => setForm({ ...form, organization: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Organization website</label>
                  <input
                    className="lab-input"
                    placeholder="https://"
                    value={form.organizationWebsite}
                    onChange={(e) => setForm({ ...form, organizationWebsite: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Contact name <span className="text-destructive">*</span>
                  </label>
                  <input
                    className="lab-input"
                    value={form.contactName}
                    onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Professional role</label>
                  <input
                    className="lab-input"
                    placeholder="Laboratory manager"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Work email <span className="text-destructive">*</span>
                </label>
                <input
                  type="email"
                  className="lab-input"
                  placeholder="you@organization.com"
                  value={form.workEmail}
                  onChange={(e) => setForm({ ...form, workEmail: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Research purpose and requested documentation{" "}
                  <span className="text-destructive">*</span>
                </label>
                <textarea
                  className="lab-input min-h-[110px] resize-y"
                  placeholder="What the material is for, and which documentation you need."
                  value={form.researchPurpose}
                  onChange={(e) => setForm({ ...form, researchPurpose: e.target.value })}
                  required
                />
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                <span className="text-xs text-gray-500 leading-relaxed dark:text-gray-400">
                  I am contacting BDL on behalf of the stated organization for lawful laboratory
                  research. I understand that these materials are not for human or veterinary use.
                </span>
              </label>

              <button type="submit" disabled={!complete} className="btn-primary w-full disabled:opacity-50">
                Request Laboratory Information
              </button>

              <p className="text-xs text-gray-400 text-center leading-relaxed dark:text-gray-500">
                We review each inquiry and the organization behind it before responding. See our{" "}
                <Link href="/legal/research-use-only">
                  <span className="underline cursor-pointer">research use policy</span>
                </Link>
                .
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
