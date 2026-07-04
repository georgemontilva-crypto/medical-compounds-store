import { useState } from "react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import { Mail, MapPin, ChevronRight, Send } from "lucide-react";
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
    <div className="min-h-screen hex-cream relative">
      {/* Mutes the hex pattern on mobile only — pattern felt too strong there */}
      <div className="absolute inset-0 bg-white/50 md:hidden pointer-events-none" />

      <div className="relative z-10">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{color:'#3A9E94'}}>
            Get in Touch
          </p>
          <h1 className="text-5xl font-light mb-4" style={{color:'#3A9E94'}}>Contact Us</h1>
          <p className="text-gray-600 text-base max-w-xl">
            Need a compound we don't list? Want bulk pricing or custom synthesis? Have a question
            about a specific COA? We respond within one business day.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-10 items-stretch lg:items-start">
          {/* ── Left: Form ────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {submitted ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{backgroundColor:'#E8F7F6'}}>
                  <Send size={24} style={{color:'#3A9E94'}} />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Message Sent</h2>
                <p className="text-gray-500 text-sm mb-6">
                  Thank you, {form.name}. We'll get back to you at {form.email} within one business day.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setForm({ name: "", email: "", phone: "", organization: "", subject: "", message: "" }); }}
                  className="text-sm font-medium hover:underline" style={{color:'#3A9E94'}}
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
                      Name <span style={{color:'#3A9E94'}}>*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Dr. Jane Smith"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7ECDC4]/40 focus:border-[#7ECDC4] transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 tracking-widest uppercase mb-1.5">
                      Email <span style={{color:'#3A9E94'}}>*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="jane@research-lab.edu"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7ECDC4]/40 focus:border-[#7ECDC4] transition"
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
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7ECDC4]/40 focus:border-[#7ECDC4] transition"
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
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7ECDC4]/40 focus:border-[#7ECDC4] transition"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 tracking-widest uppercase mb-1.5">
                    Subject <span style={{color:'#3A9E94'}}>*</span>
                  </label>
                  <div className="relative">
                    <select
                      name="subject"
                      value={form.subject}
                      onChange={handleChange}
                      className="w-full appearance-none px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#7ECDC4]/40 focus:border-[#7ECDC4] transition pr-10"
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
                    Message <span style={{color:'#3A9E94'}}>*</span>
                  </label>
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    rows={6}
                    placeholder="Tell us about your research needs..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#7ECDC4]/40 focus:border-[#7ECDC4] transition resize-none"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 bg-[#3A9E94] hover:bg-[#2A8E84] disabled:opacity-60 text-white font-semibold text-sm px-7 py-3.5 rounded-full transition-all active:scale-[0.97]"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
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
          <div className="w-full lg:w-[420px] shrink-0 flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
            {/* Direct Contact */}
            <div className="bg-[#f1f3f8] rounded-2xl p-10">
              <h3 className="font-semibold text-gray-900 text-lg mb-7">Direct Contact</h3>
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{backgroundColor:'#E8F7F6'}}>
                    <Mail size={15} style={{color:'#3A9E94'}} />
                  </div>
                  <span className="text-sm text-gray-700 break-all">support@biolabcompounds.com</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{backgroundColor:'#E8F7F6'}}>
                    <MapPin size={15} style={{color:'#3A9E94'}} />
                  </div>
                  <span className="text-sm text-gray-700">United States</span>
                </div>
              </div>

              <div className="border-t border-gray-200 mt-8 pt-6">
                <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase mb-3">
                  Company Information
                </p>
                <p className="text-sm text-gray-500 leading-relaxed">
                  Brighter Days Labs is a research-grade peptide supplier · United States · support@biolabcompounds.com
                </p>
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-[#f1f3f8] rounded-2xl p-10">
              <h3 className="font-semibold text-gray-900 text-lg mb-7">Quick Links</h3>
              <div>
                {[
                  { label: "Browse Products", href: "/compounds" },
                  { label: "Lab Tests / COAs", href: "/lab-tests" },
                  { label: "Science & Quality", href: "/science/approach" },
                  { label: "Apply for Wholesale", href: "/wholesale" },
                ].map((link) => (
                  <Link key={link.label} href={link.href}>
                    <div
                      className="flex items-center justify-between bg-white rounded-lg text-sm text-gray-700 hover:bg-[#E8F7F6] hover:text-[#3A9E94] transition-colors cursor-pointer group"
                      style={{ padding: "12px 16px", marginBottom: "10px" }}
                    >
                      <span>{link.label}</span>
                      <ChevronRight size={15} className="text-gray-400 group-hover:text-[#3A9E94] transition-colors" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
