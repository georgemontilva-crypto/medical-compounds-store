import { useRef, useState, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { toast } from "sonner";
import { Image as ImageIcon, Upload, Save, ArrowRight } from "lucide-react";

// Known content slots — must match the slotKey values read across the site.
// `section` drives the grouping headers below — keep it consistent with the
// "Página: X" convention when adding a new Science/Research page's images.
const KNOWN_SLOTS: Array<{ slotKey: string; label: string; section: string; recommended: string }> = [
  { slotKey: "site_logo", label: "Logo del sitio (navbar)", section: "Global", recommended: "PNG/SVG con fondo transparente, ~160×40px o proporción similar (se muestra a max-height 40px)" },
  { slotKey: "site_logo_footer", label: "Logo del pie de página", section: "Global", recommended: "PNG/SVG con fondo transparente, versión clara/blanca para fondo oscuro" },
  { slotKey: "global_background_pattern", label: "Fondo general del sitio (patrón repetido)", section: "Global", recommended: "Imagen pequeña que se repite en mosaico (tile), idealmente transparente o sin costuras visibles, ~80×92px o similar" },
  { slotKey: "site_favicon", label: "Favicon del sitio", section: "Global", recommended: "ICO, PNG o SVG cuadrado, ideal 32×32 o 512×512" },
  { slotKey: "hero_slide_1", label: "Home — Hero Slider, slide 1 (Tissue Repair)", section: "Home — Hero & Secciones", recommended: "Landscape, ≥1920×1080, full-bleed background" },
  { slotKey: "hero_slide_1_mobile", label: "Hero Slide 1 — Versión Mobile/Tablet", section: "Home — Hero & Secciones", recommended: "Opcional — si no se sube, usa la imagen desktop reposicionada. Portrait o cuadrada, ≥1080×1350, foco recortado para pantallas angostas" },
  { slotKey: "hero_slide_2", label: "Home — Hero Slider, slide 2 (Cellular & Neural)", section: "Home — Hero & Secciones", recommended: "Landscape, ≥1920×1080, full-bleed background" },
  { slotKey: "hero_slide_2_mobile", label: "Hero Slide 2 — Versión Mobile/Tablet", section: "Home — Hero & Secciones", recommended: "Opcional — si no se sube, usa la imagen desktop reposicionada. Portrait o cuadrada, ≥1080×1350, foco recortado para pantallas angostas" },
  { slotKey: "hero_slide_3", label: "Home — Hero Slider, slide 3 (Metabolic)", section: "Home — Hero & Secciones", recommended: "Landscape, ≥1920×1080, full-bleed background" },
  { slotKey: "hero_slide_3_mobile", label: "Hero Slide 3 — Versión Mobile/Tablet", section: "Home — Hero & Secciones", recommended: "Opcional — si no se sube, usa la imagen desktop reposicionada. Portrait o cuadrada, ≥1080×1350, foco recortado para pantallas angostas" },
  { slotKey: "home_lab_banner", label: "Home — Lab Quality Banner", section: "Home — Hero & Secciones", recommended: "Landscape, ≥1600×500, wide banner" },
  { slotKey: "home_how_it_works", label: "Home — How It Works", section: "Home — Hero & Secciones", recommended: "≥900×900, square to slightly portrait" },
  { slotKey: "approach_documentation_image", label: "Documentation trust signal image", section: "Página: Approach", recommended: "661×281 (landscape, ~2.35:1), product/vial or COA-style photo. Falls back to the vial mockup if empty." },
  { slotKey: "manufacturing_hero_image", label: "Hero image", section: "Página: Manufacturing", recommended: "Portrait or square, ≥900×900, lab/manufacturing photo" },
  { slotKey: "manufacturing_lyophilization_image", label: "Manufacturing — Lyophilization section image", section: "Página: Manufacturing", recommended: "Portrait, ≥600×800, vial/product photo. Falls back to the vial mockup if empty." },
  { slotKey: "research_standards_hero_image", label: "Hero image", section: "Página: Research Standards", recommended: "Portrait or square, ≥900×900, documentation/lab photo" },
  { slotKey: "responsible_supply_hero_image", label: "Hero image", section: "Página: Responsible Supply", recommended: "Portrait or square, ≥900×900, packaging/facility photo" },
];

// Pages whose images live in their own dedicated admin screen/table instead
// of site_images (Categories has its own hero-image fields per row;
// DocIntegritySection is a singleton row with its own uploader) — shown as
// link-outs here so this page stays the map of "where is every image", even
// for the ones it doesn't directly manage.
const LINKED_SECTIONS: Array<{ section: string; label: string; description: string; href: string }> = [
  {
    section: "Categorías",
    label: "Category hero images, badges & taglines",
    description: "Cada categoría tiene su propia imagen hero, badge, tagline y CTA — se administran en la pantalla de Categorías.",
    href: "/admin/categories",
  },
  {
    section: "Documentation Section",
    label: "Documentation by Design — hero image & callouts",
    description: "La imagen y los 3 callouts de esa sección del Home tienen su propia pantalla de administración.",
    href: "/admin/doc-integrity",
  },
];

// Known editable text settings (site_settings table) — shown on this same screen.
const KNOWN_TEXT_SETTINGS: Array<{ key: string; label: string; placeholder: string }> = [
  { key: "footer_copyright", label: "Texto de copyright del footer", placeholder: "© 2026 Brighter Days Labs" },
];

function TextSettingCard({ settingKey, label, placeholder }: { settingKey: string; label: string; placeholder: string }) {
  const utils = trpc.useUtils();
  const { data: setting, isLoading } = trpc.siteSettings.get.useQuery({ key: settingKey });
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched && setting) setValue(setting.value);
  }, [setting, touched]);

  const saveMutation = trpc.siteSettings.set.useMutation({
    onSuccess: () => {
      toast.success("Texto actualizado");
      setTouched(false);
      utils.siteSettings.get.invalidate({ key: settingKey });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-900">{label}</p>
      <p className="text-[11px] text-gray-300 mt-0.5 font-mono">{settingKey}</p>
      <textarea
        value={isLoading ? "" : value}
        onChange={(e) => { setValue(e.target.value); setTouched(true); }}
        placeholder={placeholder}
        rows={2}
        className="mt-3 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#dbcfba]/30 focus:border-[#dbcfba] resize-none"
      />
      <p className="text-xs text-gray-400 mt-1">
        {setting ? "Usando el valor de arriba." : `Vacío — mostrando el texto original: "${placeholder}"`}
      </p>
      <button
        onClick={() => saveMutation.mutate({ key: settingKey, value })}
        disabled={saveMutation.isPending || isLoading}
        className="mt-3 w-full flex items-center justify-center gap-2 bg-[#d3c4ab] hover:bg-[#baac96] disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-xl transition-colors"
      >
        <Save size={13} />
        {saveMutation.isPending ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}

// Same 2+/5+ quantity thresholds for every product — only the percentages
// are editable here (client reads them via trpc.bulkDiscount.get).
function BulkDiscountCard() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.bulkDiscount.get.useQuery();
  const [tier2, setTier2] = useState("");
  const [tier5, setTier5] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched && data) {
      setTier2(String(data.tier2Percent));
      setTier5(String(data.tier5Percent));
    }
  }, [data, touched]);

  const saveMutation = trpc.bulkDiscount.update.useMutation({
    onSuccess: () => {
      toast.success("Descuentos por volumen actualizados");
      setTouched(false);
      utils.bulkDiscount.get.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSave = () => {
    const t2 = Number(tier2);
    const t5 = Number(tier5);
    if ([t2, t5].some((n) => Number.isNaN(n) || n < 0 || n > 100)) {
      toast.error("Los porcentajes deben ser números entre 0 y 100");
      return;
    }
    saveMutation.mutate({ tier2Percent: t2, tier5Percent: t5 });
  };

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-900">Descuentos por volumen (todos los productos)</p>
      <p className="text-xs text-gray-400 mt-0.5">
        Mismos umbrales de cantidad para todo el catálogo — solo el % de descuento es editable.
      </p>
      <div className="grid grid-cols-2 gap-3 mt-3">
        {[
          { label: "2+ unidades", value: tier2, setValue: setTier2 },
          { label: "5+ unidades", value: tier5, setValue: setTier5 },
        ].map((tier) => (
          <label key={tier.label} className="block">
            <span className="text-xs text-gray-500">{tier.label}</span>
            <div className="mt-1 flex items-center border border-gray-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-[#dbcfba]/30 focus-within:border-[#dbcfba]">
              <input
                type="number"
                min={0}
                max={100}
                value={isLoading ? "" : tier.value}
                onChange={(e) => { tier.setValue(e.target.value); setTouched(true); }}
                className="w-full text-sm focus:outline-none"
              />
              <span className="text-xs text-gray-400">%</span>
            </div>
          </label>
        ))}
      </div>
      <button
        onClick={handleSave}
        disabled={saveMutation.isPending || isLoading}
        className="mt-3 w-full flex items-center justify-center gap-2 bg-[#d3c4ab] hover:bg-[#baac96] disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-xl transition-colors"
      >
        <Save size={13} />
        {saveMutation.isPending ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );
}

export default function AdminSiteImages() {
  const utils = trpc.useUtils();
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<{ slotKey: string; label: string } | null>(null);

  const { data: images = [], isLoading } = trpc.siteImages.list.useQuery();
  const imageBySlot = Object.fromEntries(images.map((img) => [img.slotKey, img]));

  const { data: heroConfigs = [] } = trpc.heroSlidesConfig.list.useQuery();
  const heroConfigBySlot = Object.fromEntries(heroConfigs.map((c) => [c.slotKey, c]));

  const uploadMutation = trpc.siteImages.upload.useMutation({
    onSuccess: () => {
      toast.success("Image updated");
      utils.siteImages.list.invalidate();
      utils.siteImages.getBySlot.invalidate();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setUploadingSlot(null),
  });

  const heroConfigMutation = trpc.heroSlidesConfig.update.useMutation({
    onSuccess: () => utils.heroSlidesConfig.list.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  function triggerUpload(slotKey: string, label: string) {
    pendingSlot.current = { slotKey, label };
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const slot = pendingSlot.current;
    e.target.value = "";
    if (!file || !slot) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files are allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10 MB");
      return;
    }
    setUploadingSlot(slot.slotKey);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      uploadMutation.mutate({
        slotKey: slot.slotKey,
        label: slot.label,
        fileBase64: base64,
        fileName: file.name,
        mimeType: file.type,
      });
    };
    reader.readAsDataURL(file);
  }

  // Explicit display order — interleaves the link-out sections (whose images
  // live on their own admin screens) with the site_images-backed ones. Add a
  // new "Página: X" entry here (and to KNOWN_SLOTS/LINKED_SECTIONS) once a
  // page has an image slot of its own.
  const SECTION_ORDER = [
    "Global",
    "Home — Hero & Secciones",
    "Categorías",
    "Documentation Section",
    "Página: Approach",
    "Página: Manufacturing",
    "Página: Research Standards",
    "Página: Responsible Supply",
  ];

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-gray-900">Site Images</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage the hero and homepage content images. Slots without an uploaded image keep showing the
            original template photo until you replace them here.
          </p>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />

        {isLoading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          SECTION_ORDER.map((section) => {
            const linked = LINKED_SECTIONS.find((l) => l.section === section);
            if (linked) {
              return (
                <div key={section} className="mb-8">
                  <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">{section}</h2>
                  <Link href={linked.href}>
                    <div className="flex items-center justify-between bg-white border border-gray-100 rounded-2xl p-5 hover:border-gray-200 cursor-pointer transition-colors group">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{linked.label}</p>
                        <p className="text-xs text-gray-400 mt-1">{linked.description}</p>
                      </div>
                      <ArrowRight size={16} className="text-gray-300 group-hover:text-[#d3c4ab] transition-colors shrink-0 ml-4" />
                    </div>
                  </Link>
                </div>
              );
            }

            const slotsInSection = KNOWN_SLOTS.filter((s) => s.section === section);
            if (slotsInSection.length === 0) return null;

            return (
            <div key={section} className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">{section}</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {slotsInSection.map((slot) => {
                  const current = imageBySlot[slot.slotKey];
                  const isUploading = uploadingSlot === slot.slotKey;
                  const isHeroSlide = slot.slotKey.startsWith("hero_slide_");
                  const heroConfig = heroConfigBySlot[slot.slotKey];
                  const isActive = heroConfig?.active ?? true;
                  const isAnimated = heroConfig?.animationEnabled ?? true;
                  return (
                    <div key={slot.slotKey} className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                      <div className="relative h-40 bg-gray-50">
                        {current ? (
                          <img src={current.url} alt={slot.label} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                            <ImageIcon size={28} />
                            <span className="text-xs mt-2 text-gray-400">Using template default</span>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <p className="text-sm font-semibold text-gray-900">{slot.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{slot.recommended}</p>
                        <p className="text-[11px] text-gray-300 mt-1 font-mono">{slot.slotKey}</p>
                        {isHeroSlide && (
                          <div className="flex items-center gap-4 mt-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) =>
                                  heroConfigMutation.mutate({ slotKey: slot.slotKey, active: e.target.checked })
                                }
                                className="rounded"
                              />
                              <span className="text-xs font-medium text-gray-700">Activo</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isAnimated}
                                onChange={(e) =>
                                  heroConfigMutation.mutate({ slotKey: slot.slotKey, animationEnabled: e.target.checked })
                                }
                                className="rounded"
                              />
                              <span className="text-xs font-medium text-gray-700">Animación</span>
                            </label>
                          </div>
                        )}
                        <button
                          onClick={() => triggerUpload(slot.slotKey, slot.label)}
                          disabled={isUploading}
                          className="mt-3 w-full flex items-center justify-center gap-2 bg-[#d3c4ab] hover:bg-[#baac96] disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-xl transition-colors"
                        >
                          <Upload size={13} />
                          {isUploading ? "Uploading..." : "Reemplazar imagen"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })
        )}

        {/* Editable text (site_settings) — same screen as the images */}
        <div className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Textos editables</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {KNOWN_TEXT_SETTINGS.map((setting) => (
              <TextSettingCard
                key={setting.key}
                settingKey={setting.key}
                label={setting.label}
                placeholder={setting.placeholder}
              />
            ))}
          </div>
        </div>

        {/* Bulk (volume) discount tiers — same screen, same site_settings table */}
        <div className="mb-8">
          <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">Descuentos por volumen</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <BulkDiscountCard />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
