import { useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { toast } from "sonner";
import { Image as ImageIcon, Upload } from "lucide-react";

// Known content slots — must match the slotKey values read by HeroSlider.tsx / Home.tsx.
const KNOWN_SLOTS: Array<{ slotKey: string; label: string; section: string; recommended: string }> = [
  { slotKey: "global_background_pattern", label: "Fondo general del sitio (patrón repetido)", section: "Global", recommended: "Imagen pequeña que se repite en mosaico (tile), idealmente transparente o sin costuras visibles, ~80×92px o similar" },
  { slotKey: "hero_slide_1", label: "Hero Slider — Slide 1 (Tissue Repair)", section: "Hero Slider", recommended: "Landscape, ≥1920×1080, full-bleed background" },
  { slotKey: "hero_slide_2", label: "Hero Slider — Slide 2 (Cellular & Neural)", section: "Hero Slider", recommended: "Landscape, ≥1920×1080, full-bleed background" },
  { slotKey: "hero_slide_3", label: "Hero Slider — Slide 3 (Metabolic)", section: "Hero Slider", recommended: "Landscape, ≥1920×1080, full-bleed background" },
  { slotKey: "hero_slide_4", label: "Hero Slider — Slide 4 (Endocrine)", section: "Hero Slider", recommended: "Landscape, ≥1920×1080, full-bleed background" },
  { slotKey: "home_lab_banner", label: "Home — Lab Quality Banner", section: "Home", recommended: "Landscape, ≥1600×500, wide banner" },
  { slotKey: "home_spotlight_bpc157", label: "Home — Compound Spotlight (BPC-157)", section: "Home", recommended: "Portrait 3:4, ≥400×540" },
  { slotKey: "home_spotlight_nadplus", label: "Home — Compound Spotlight (NAD+)", section: "Home", recommended: "Portrait 3:4, ≥400×540" },
  { slotKey: "home_how_it_works", label: "Home — How It Works", section: "Home", recommended: "≥900×900, square to slightly portrait" },
];

export default function AdminSiteImages() {
  const utils = trpc.useUtils();
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<{ slotKey: string; label: string } | null>(null);

  const { data: images = [], isLoading } = trpc.siteImages.list.useQuery();
  const imageBySlot = Object.fromEntries(images.map((img) => [img.slotKey, img]));

  const uploadMutation = trpc.siteImages.upload.useMutation({
    onSuccess: () => {
      toast.success("Image updated");
      utils.siteImages.list.invalidate();
      utils.siteImages.getBySlot.invalidate();
    },
    onError: (err) => toast.error(err.message),
    onSettled: () => setUploadingSlot(null),
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

  const sections = Array.from(new Set(KNOWN_SLOTS.map((s) => s.section)));

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
          sections.map((section) => (
            <div key={section} className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-3">{section}</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                {KNOWN_SLOTS.filter((s) => s.section === section).map((slot) => {
                  const current = imageBySlot[slot.slotKey];
                  const isUploading = uploadingSlot === slot.slotKey;
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
                        <button
                          onClick={() => triggerUpload(slot.slotKey, slot.label)}
                          disabled={isUploading}
                          className="mt-3 w-full flex items-center justify-center gap-2 bg-[#3A9E94] hover:bg-[#2A8E84] disabled:opacity-50 text-white text-xs font-semibold py-2 rounded-xl transition-colors"
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
          ))
        )}
      </div>
    </AdminLayout>
  );
}
