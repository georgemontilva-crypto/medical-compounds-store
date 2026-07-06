import { useState } from "react";
import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import { Mail, MapPin, ChevronRight, Send } from "lucide-react";
import { toast } from "sonner";
import ParticleBackground from "@/components/ParticleBackground";
import { useTheme } from "@/contexts/ThemeContext";

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
  const { theme } = useTheme();
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
    <div className="min-h-screen bg-background relative overflow-hidden">
      <ParticleBackground
        color={theme === "dark" ? "211, 196, 171" : "38, 38, 38"}
        particleRadius={3.5}
        particleOpacity={0.22}
        lineOpacity={0.14}
        linkDistance={150}
        className="absolute inset-0 w-full h-full"
      />

      <div className="relative z-10">
      <Navbar />

      <main className="max-w-6xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{color:'#d3c4ab'}}>
            Get in Touch
          </p>
          <h1 className="text-5xl font-light mb-4" style={{color:'#d3c4ab'}}>Contact Us</h1>
          <p className="text-gray-600 text-base max-w-xl dark:text-gray-300">
            Need a compound we don't list? Want bulk pricing or custom synthesis? Have a question
            about a specific COA? We respond within one business day.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-10 items-stretch lg:items-start">
          {/* ── Left: Form ────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            {submitted ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center dark:bg-card dark:border-border">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-[#f2ede6] dark:bg-white/10">
                  <Send size={24} style={{color:'#d3c4ab'}} />
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2 dark:text-white">Message Sent</h2>
                <p className="text-gray-500 text-sm mb-6 dark:text-gray-400">
                  Thank you, {form.name}. We'll get back to you at {form.email} within one business day.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setForm({ name: "", email: "", phone: "", organization: "", subject: "", message: "" }); }}
                  className="text-sm font-medium hover:underline" style={{color:'#d3c4ab'}}
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Row 1: Name + Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 tracking-widest uppercase mb-1.5 dark:text-gray-400">
                      Name <span style={{color:'#d3c4ab'}}>*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Dr. Jane Smith"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#dbcfba]/40 focus:border-[#dbcfba] transition dark:border-border dark:bg-card dark:text-gray-100 dark:placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 tracking-widest uppercase mb-1.5 dark:text-gray-400">
                      Email <span style={{color:'#d3c4ab'}}>*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="jane@research-lab.edu"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#dbcfba]/40 focus:border-[#dbcfba] transition dark:border-border dark:bg-card dark:text-gray-100 dark:placeholder-gray-500"
                    />
                  </div>
                </div>

                {/* Row 2: Phone + Organization */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 tracking-widest uppercase mb-1.5 dark:text-gray-400">
                      Phone{" "}
                      <span className="normal-case font-normal text-gray-400 dark:text-gray-500">(optional — for SMS replies)</span>
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      placeholder="(555) 555-5555"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#dbcfba]/40 focus:border-[#dbcfba] transition dark:border-border dark:bg-card dark:text-gray-100 dark:placeholder-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 tracking-widest uppercase mb-1.5 dark:text-gray-400">
                      Organization
                    </label>
                    <input
                      type="text"
                      name="organization"
                      value={form.organization}
                      onChange={handleChange}
                      placeholder="University / Lab / Company"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#dbcfba]/40 focus:border-[#dbcfba] transition dark:border-border dark:bg-card dark:text-gray-100 dark:placeholder-gray-500"
                    />
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 tracking-widest uppercase mb-1.5 dark:text-gray-400">
                    Subject <span style={{color:'#d3c4ab'}}>*</span>
                  </label>
                  <div className="relative">
                    <select
                      name="subject"
                      value={form.subject}
                      onChange={handleChange}
                      className="w-full appearance-none px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#dbcfba]/40 focus:border-[#dbcfba] transition pr-10 dark:border-border dark:bg-card dark:text-gray-100"
                    >
                      <option value="" disabled>Select a topic</option>
                      {SUBJECTS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                      <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 tracking-widest uppercase mb-1.5 dark:text-gray-400">
                    Message <span style={{color:'#d3c4ab'}}>*</span>
                  </label>
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    rows={6}
                    placeholder="Tell us about your research needs..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#dbcfba]/40 focus:border-[#dbcfba] transition resize-none dark:border-border dark:bg-card dark:text-gray-100 dark:placeholder-gray-500"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 bg-[#d3c4ab] hover:bg-[#baac96] disabled:opacity-60 text-white font-semibold text-sm px-7 py-3.5 rounded-full transition-all active:scale-[0.97]"
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
            <div className="bg-[#f1f3f8] rounded-2xl p-10 dark:bg-card">
              <h3 className="font-semibold text-gray-900 text-lg mb-7 dark:text-white">Direct Contact</h3>
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-[#f2ede6] dark:bg-white/10">
                    <Mail size={15} style={{color:'#d3c4ab'}} />
                  </div>
                  <span className="text-sm text-gray-700 break-all dark:text-gray-300">support@biolabcompounds.com</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-[#f2ede6] dark:bg-white/10">
                    <MapPin size={15} style={{color:'#d3c4ab'}} />
                  </div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">United States</span>
                </div>
              </div>

              <div className="border-t border-gray-200 mt-8 pt-6 dark:border-border">
                <p className="text-[10px] font-semibold text-gray-400 tracking-widest uppercase mb-3 dark:text-gray-500">
                  Company Information
                </p>
                <p className="text-sm text-gray-500 leading-relaxed dark:text-gray-400">
                  Brighter Days Labs is a research-grade peptide supplier · United States · support@biolabcompounds.com
                </p>
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-[#f1f3f8] rounded-2xl p-10 dark:bg-card">
              <h3 className="font-semibold text-gray-900 text-lg mb-7 dark:text-white">Quick Links</h3>
              <div>
                {[
                  { label: "Browse Products", href: "/compounds" },
                  { label: "Lab Tests / COAs", href: "/lab-tests" },
                  { label: "Science & Quality", href: "/science/approach" },
                  { label: "Apply for Wholesale", href: "/wholesale" },
                ].map((link) => (
                  <Link key={link.label} href={link.href}>
                    <div
                      className="flex items-center justify-between bg-white rounded-lg text-sm text-gray-700 hover:bg-[#f2ede6] hover:text-[#d3c4ab] transition-colors cursor-pointer group dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15"
                      style={{ padding: "12px 16px", marginBottom: "10px" }}
                    >
                      <span>{link.label}</span>
                      <ChevronRight size={15} className="text-gray-400 group-hover:text-[#d3c4ab] transition-colors dark:text-gray-500" />
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
