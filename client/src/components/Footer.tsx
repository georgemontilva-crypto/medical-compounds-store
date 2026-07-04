import { trpc } from "@/lib/trpc";
import { FlaskConical } from "lucide-react";

export default function Footer() {
  const { data: logoImage } = trpc.siteImages.getBySlot.useQuery({ slotKey: "site_logo_footer" });
  const { data: footerCopyrightSetting } = trpc.siteSettings.get.useQuery({ key: "footer_copyright" });

  return (
    <footer className="bg-gray-950 text-gray-400 py-12">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {logoImage?.url ? (
            <img src={logoImage.url} alt="Logo" className="h-8 w-auto object-contain" />
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#7ECDC4] flex items-center justify-center">
                <FlaskConical size={15} className="text-white" />
              </div>
              <div>
                <span className="font-bold text-white text-sm">Brighter Days Labs</span>
                <p className="text-[11px] text-gray-500 leading-none mt-0.5">Research Grade · For Scientific Use Only</p>
              </div>
            </div>
          )}
          <p className="text-xs text-gray-600 text-center">
            For research purposes only. Not for human consumption. All compounds are intended for laboratory use.
          </p>
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
