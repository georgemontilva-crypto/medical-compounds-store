import { useState } from "react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import { Mail, MapPin, Clock, ChevronRight, Send } from "lucide-react";
import { toast } from "sonner";

const SUBJECTS = [
  "Product Inquiry",
  "Bulk / Wholesale Pricing",
  "Custom Synthesis Request",
  "COA / Lab Report Question",
  "Order Support",
  "Research Collaboration",
  "Other",
];

export default function Contact() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    organization: "",
    subject: "",
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.subject || !form.message) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSubmitting(true);
    // Simulate send (replace with real API call when needed)
    await new Promise((r) => setTimeout(r, 1200));
    setSubmitting(false);
    setSubmitted(true);
    toast.success("Message sent! We'll respond within one business day.");
  };

  return (
    <div className="min-h-screen bg-[#f8f8fa]">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-10">
          <p className="text-violet-600 text-xs font-semibold tracking-widest uppercase mb-2">
            Get in Touch
          </p>
          <h1 className="text-5xl font-light text-violet-500 mb-4">Contact Us</h1>
          <p className="text-gray-600 text-base max-w-xl">
            Need a compound we don't list? Want bulk pricing or custom synthesis? Have a question
            about a specific COA? We respond within one business day.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* ── Left: Form ────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {submitted ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                <div className="w-14 h-14 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-4">
                  <Send size={24} className="text-violet-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Message Sent</h2>
                <p className="text-gray-500 text-sm mb-6">
                  Thank you, {form.name}. We'll get back to you at {form.email} within one business day.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setForm({ name: "", email: "", phone: "", organization: "", subject: "", message: "" }); }}
                  className="text-violet-600 text-sm font-medium hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Row 1: Name + Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 tracking-widest uppercase mb-1.5">
                      Name <span className="text-violet-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Dr. Jane Smith"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 tracking-widest uppercase mb-1.5">
                      Email <span className="text-violet-500">*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="jane@research-lab.edu"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition"
                    />
                  </div>
                </div>

                {/* Row 2: Phone + Organization */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 tracking-widest uppercase mb-1.5">
                      Phone{" "}
                      <span className="normal-case font-normal text-gray-400">(optional — for SMS replies)</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="(555) 555-5555"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 tracking-widest uppercase mb-1.5">
                      Organization
                    </label>
                    <input
                      type="text"
                      name="organization"
                      value={form.organization}
                      onChange={handleChange}
                      placeholder="University / Lab / Company"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 tracking-widest uppercase mb-1.5">
                    Subject <span className="text-violet-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      name="subject"
                      value={form.subject}
                      onChange={handleChange}
                      className="w-full appearance-none px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition pr-10"
                    >
                      <option value="" disabled>Select a topic</option>
                      {SUBJECTS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 tracking-widest uppercase mb-1.5">
                    Message <span className="text-violet-500">*</span>
                  </label>
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    rows={6}
                    placeholder="Tell us about your research needs..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-400 transition resize-none"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 text-white font-semibold text-sm px-7 py-3.5 rounded-full transition-all active:scale-[0.97]"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      Send Message
                      <Send size={15} />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* ── Right: Info panels ────────────────────────────────────── */}
          <div className="w-full lg:w-80 shrink-0 flex flex-col gap-5">
            {/* Direct Contact */}
            <div className="bg-[#eef0f7] rounded-2xl p-6">
              <h3 className="font-semibold text-gray-900 text-base mb-4">Direct Contact</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                    <Mail size={15} className="text-violet-600" />
                  </div>
                  <span className="text-sm text-gray-700">support@biolabcompounds.com</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                    <MapPin size={15} className="text-violet-600" />
                  </div>
                  <span className="text-sm text-gray-700">United States</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                    <Clock size={15} className="text-violet-600" />
                  </div>
                  <span className="text-sm text-gray-700">Mon–Fri, 9am–6pm EST</span>
                </div>
              </div>

              <div className="border-t border-gray-200 mt-5 pt-4">
                <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase mb-2">
                  Company Information
                </p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  BioLab Compounds is a research-grade peptide supplier · United States · support@biolabcompounds.com
                </p>
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-[#eef0f7] rounded-2xl p-6">
              <h3 className="font-semibold text-gray-900 text-base mb-4">Quick Links</h3>
              <div className="space-y-2">
                {[
                  { label: "Browse Products", href: "/compounds" },
                  { label: "COA Library", href: "/compounds" },
                  { label: "Science & Quality", href: "/compounds" },
                  { label: "FAQ", href: "/compounds" },
                ].map((link) => (
                  <Link key={link.label} href={link.href}>
                    <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 text-sm text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors cursor-pointer group">
                      <span>{link.label}</span>
                      <ChevronRight size={15} className="text-gray-400 group-hover:text-violet-500 transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
