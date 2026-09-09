import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { FlaskConical, ArrowRight, MapPin, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import Reveal from "@/components/Reveal";

const SCIENCE_LINKS = [
  { label: "Approach", href: "/science/approach" },
  { label: "Manufacturing", href: "/science/manufacturing" },
  { label: "Research Standards", href: "/science/research-standards" },
  { label: "Lab Tests", href: "/lab-tests" },
];

const LEGAL_LINKS = [
  { label: "Research Use Only Policy", href: "/legal/research-use-only" },
  { label: "Website Disclaimer", href: "/legal/website-disclaimer" },
  { label: "Terms of Service", href: "/legal/terms-of-service" },
  { label: "Shipping Policy", href: "/legal/shipping-policy" },
];

const SUPPORT_LINKS = [
  { label: "Blog", href: "/blog" },
  { label: "FAQ", href: "/faq" },
  { label: "Track Order", href: "/track-order" },
  { label: "Contact", href: "/contact" },
];

const DEFAULT_HEX_PATTERN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='92' viewBox='0 0 80 92'%3E%3Cpolygon points='40,2 78,22 78,70 40,90 2,70 2,22' fill='none' stroke='%23ffffff' stroke-width='0.9' stroke-opacity='0.5'/%3E%3C/svg%3E\")";

function FooterLink({ label, href }: { label: string; href: string }) {
  return (
    <li>
      <Link href={href}>
        <span className="group relative inline-block text-sm text-gray-400 hover:text-[#dbcfba] transition-colors cursor-pointer">
          {label}
          <span className="absolute left-0 -bottom-0.5 h-px w-0 bg-[#dbcfba] transition-all duration-300 ease-out group-hover:w-full" />
        </span>
      </Link>
    </li>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-4">{title}</p>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <FooterLink key={link.href} label={link.label} href={link.href} />
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  const { data: logoImage } = trpc.siteImages.getBySlot.useQuery({ slotKey: "site_logo_footer" });
  const { data: footerCopyrightSetting } = trpc.siteSettings.get.useQuery({ key: "footer_copyright" });
  const { data: categories = [] } = trpc.categories.list.useQuery();
  const [email, setEmail] = useState("");

  const topCategories = categories.slice(0, 5);
  const shopLinks = [
    { label: "Browse Compounds", href: "/compounds" },
    ...topCategories.map((c) => ({ label: c.name, href: `/compounds?category=${c.slug}` })),
    { label: "Apply for Wholesale", href: "/wholesale" },
  ];

  const gradient =
    categories.length > 0
      ? `linear-gradient(90deg, ${categories.map((c) => c.color ?? "#dbcfba").join(", ")})`
      : "linear-gradient(90deg, #dbcfba, #C8A84B)";

  function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    toast.success("Thanks — we'll keep you posted on new batches and COAs.");
    setEmail("");
  }

  return (
    <Reveal>
      <footer className="relative bg-gray-950 dark:bg-black text-gray-400 overflow-hidden">
        <div className="h-[3px] w-full" style={{ background: gradient }} />

        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage: `var(--hex-bg-pattern, ${DEFAULT_HEX_PATTERN})`,
            backgroundSize: "var(--hex-bg-size, 80px 92px)",
            backgroundRepeat: "repeat",
          }}
        />

        <div className="container relative py-16">
          {/* Top block: logo + tagline + newsletter */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-10 pb-12">
            <div>
              {logoImage?.url ? (
                <img src={logoImage.url} alt="Brighter Days Labs logo" className="h-14 w-auto object-contain mb-4" />
              ) : (
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-lg bg-[#dbcfba] flex items-center justify-center">
                    <FlaskConical size={22} className="text-white" />
                  </div>
                  <span className="font-bold text-white text-lg">Brighter Days Labs</span>
                </div>
              )}
              <p className="text-sm text-gray-500 max-w-xs flex items-start gap-1.5">
                <img
                  src="https://pub-f9dc97453f1244a0a96fa1fb85c35d2e.r2.dev/site-images/Flag_of_the_United_States.svg"
                  alt=""
                  aria-hidden="true"
                  className="w-4 h-3 rounded-[1px] object-cover flex-shrink-0 mt-0.5"
                />
                <span>MADE IN USA. Research-grade compounds, documented at every batch.</span>
              </p>
            </div>

            <div className="w-full lg:w-auto lg:min-w-[340px]">
              <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-3">Stay Updated</p>
              <form onSubmit={handleSubscribe} className="flex gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@lab.com"
                  className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#dbcfba]/50 transition-colors"
                />
                <button
                  type="submit"
                  aria-label="Subscribe"
                  className="shrink-0 bg-[#dbcfba] text-[#0d1a18] rounded-xl px-4 hover:bg-[#d7cab3] transition-colors active:scale-[0.98]"
                >
                  <ArrowRight size={16} />
                </button>
              </form>
            </div>
          </div>

          {/* Link columns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 py-12 border-t border-white/10">
            <FooterColumn title="Shop" links={shopLinks} />
            <FooterColumn title="Science" links={SCIENCE_LINKS} />
            <FooterColumn title="Legal" links={LEGAL_LINKS} />
            <FooterColumn title="Support" links={SUPPORT_LINKS} />
          </div>

          {/* Disclaimer */}
          <div className="pt-10 border-t border-white/10">
            <p className="text-[11px] text-gray-600 text-center max-w-3xl mx-auto leading-relaxed">
              FOR RESEARCH USE ONLY. NOT FOR HUMAN OR VETERINARY USE. NOT FOR HUMAN OR ANIMAL CONSUMPTION.
            </p>
            <p className="text-[11px] text-gray-600 text-center max-w-3xl mx-auto leading-relaxed mt-2">
              These products are intended solely for in vitro laboratory research by qualified professionals. They are
              not intended to diagnose, treat, cure, mitigate, or prevent any disease or medical condition and have not
              been evaluated or approved by the U.S. Food and Drug Administration for therapeutic or clinical use.
            </p>
            <p className="text-[11px] text-gray-600 text-center max-w-3xl mx-auto leading-relaxed mt-2">
              By purchasing these products, the purchaser acknowledges that they are intended solely for lawful
              laboratory research purposes.
            </p>
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8 pt-8 border-t border-white/10">
            <p className="text-xs text-gray-600">{footerCopyrightSetting?.value ?? "© 2026 Brighter Days Labs"}</p>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 border border-white/10 text-gray-500 text-[11px] px-3 py-1 rounded-full">
                <MapPin size={11} /> Made in USA
              </span>
              <span className="inline-flex items-center gap-1.5 border border-white/10 text-gray-500 text-[11px] px-3 py-1 rounded-full">
                <ShieldCheck size={11} /> Research Use Only
              </span>
            </div>
          </div>
        </div>
      </footer>
    </Reveal>
  );
}
