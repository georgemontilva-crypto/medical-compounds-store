import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { FlaskConical } from "lucide-react";

const LEGAL_LINKS = [
  { label: "Research Use Only Policy", href: "/legal/research-use-only" },
  { label: "Website Disclaimer", href: "/legal/website-disclaimer" },
  { label: "Terms of Service", href: "/legal/terms-of-service" },
  { label: "Shipping Policy", href: "/legal/shipping-policy" },
  { label: "FAQ", href: "/faq" },
];

const COMPANY_LINKS = [
  { label: "Contact", href: "/contact" },
  { label: "Wholesale Application", href: "/wholesale" },
];

function FooterLinkColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-4">{title}</p>
      <ul className="space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href}>
              <span className="text-sm text-gray-400 hover:text-white transition-colors cursor-pointer">
                {link.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  const { data: logoImage } = trpc.siteImages.getBySlot.useQuery({ slotKey: "site_logo_footer" });
  const { data: footerCopyrightSetting } = trpc.siteSettings.get.useQuery({ key: "footer_copyright" });

  return (
    <footer className="bg-gray-950 text-gray-400 py-12">
      <div className="container">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 pb-10 border-b border-gray-800">
          <div className="col-span-2 sm:col-span-1">
            {logoImage?.url ? (
              <img src={logoImage.url} alt="Logo" className="h-14 w-auto object-contain" />
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-[#7ECDC4] flex items-center justify-center">
                  <FlaskConical size={22} className="text-white" />
                </div>
                <div>
                  <span className="font-bold text-white text-lg">Brighter Days Labs</span>
                  <p className="text-xs text-gray-500 leading-none mt-1">Research Grade · For Scientific Use Only</p>
                </div>
              </div>
            )}
          </div>
          <FooterLinkColumn title="Legal" links={LEGAL_LINKS} />
          <FooterLinkColumn title="Company" links={COMPANY_LINKS} />
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-8">
          <p className="text-xs text-gray-600">{footerCopyrightSetting?.value ?? "© 2026 Brighter Days Labs"}</p>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-800">
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
      </div>
    </footer>
  );
}
