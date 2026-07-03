import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { toast } from "sonner";
import { Upload, Image as ImageIcon, Save } from "lucide-react";

type CalloutPosition = "top" | "middle" | "bottom";

type FormState = {
  eyebrowText: string;
  headingLine1: string;
  headingLine2: string;
  bodyText: string;
  cardBadge: string;
  cardSubtext: string;
  cardTitle: string;
  cardDetail: string;
  callout1Position: CalloutPosition;
  callout1Title: string;
  callout1Description: string;
  callout2Position: CalloutPosition;
  callout2Title: string;
  callout2Description: string;
  callout3Position: CalloutPosition;
  callout3Title: string;
  callout3Description: string;
};

const emptyForm: FormState = {
  eyebrowText: "", headingLine1: "", headingLine2: "", bodyText: "",
  cardBadge: "", cardSubtext: "", cardTitle: "", cardDetail: "",
  callout1Position: "top", callout1Title: "", callout1Description: "",
  callout2Position: "middle", callout2Title: "", callout2Description: "",
  callout3Position: "bottom", callout3Title: "", callout3Description: "",
};

export default function AdminDocIntegrity() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.docIntegrity.get.useQuery();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [touched, setTouched] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (touched || !data) return;
    setForm({
      eyebrowText: data.eyebrowText ?? "",
      headingLine1: data.headingLine1 ?? "",
      headingLine2: data.headingLine2 ?? "",
      bodyText: data.bodyText ?? "",
      cardBadge: data.cardBadge ?? "",
      cardSubtext: data.cardSubtext ?? "",
      cardTitle: data.cardTitle ?? "",
      cardDetail: data.cardDetail ?? "",
      callout1Position: data.callout1Position ?? "top",
      callout1Title: data.callout1Title ?? "",
      callout1Description: data.callout1Description ?? "",
      callout2Position: data.callout2Position ?? "middle",
      callout2Title: data.callout2Title ?? "",
      callout2Description: data.callout2Description ?? "",
      callout3Position: data.callout3Position ?? "bottom",
      callout3Title: data.callout3Title ?? "",
      callout3Description: data.callout3Description ?? "",
    });
  }, [data, touched]);

  const updateMutation = trpc.docIntegrity.update.useMutation({
    onSuccess: () => {
      toast.success("Saved");
      setTouched(false);
      utils.docIntegrity.get.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadImageMutation = trpc.docIntegrity.uploadImage.useMutation({
    onSuccess: () => { toast.success("Image updated"); utils.docIntegrity.get.invalidate(); },
    onError: (e) => toast.error(e.message),
    onSettled: () => setUploadingImage(false),
  });

  function handleImageUpload(file: File) {
    setUploadingImage(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string).split(",")[1];
      uploadImageMutation.mutate({ fileBase64: base64, fileName: file.name, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  }

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setTouched(true);
  }

  function setCalloutPosition(field: "callout1Position" | "callout2Position" | "callout3Position", value: string) {
    setForm((f) => ({ ...f, [field]: value as CalloutPosition }));
    setTouched(true);
  }

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-6 max-w-4xl mx-auto">
          <div className="h-8 bg-gray-100 rounded w-1/3 animate-pulse mb-6" />
          <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      </AdminLayout>
    );
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#7ECDC4]/30 focus:border-[#7ECDC4]";
  const labelCls = "block text-xs font-semibold text-gray-600 mb-1.5";

  const callouts: Array<{
    n: 1 | 2 | 3;
    position: CalloutPosition;
    positionField: "callout1Position" | "callout2Position" | "callout3Position";
    title: string;
    titleField: "callout1Title" | "callout2Title" | "callout3Title";
    description: string;
    descriptionField: "callout1Description" | "callout2Description" | "callout3Description";
  }> = [
    { n: 1, position: form.callout1Position, positionField: "callout1Position", title: form.callout1Title, titleField: "callout1Title", description: form.callout1Description, descriptionField: "callout1Description" },
    { n: 2, position: form.callout2Position, positionField: "callout2Position", title: form.callout2Title, titleField: "callout2Title", description: form.callout2Description, descriptionField: "callout2Description" },
    { n: 3, position: form.callout3Position, positionField: "callout3Position", title: form.callout3Title, titleField: "callout3Title", description: form.callout3Description, descriptionField: "callout3Description" },
  ];

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Documentation by Design</h1>
          <p className="text-sm text-gray-500 mt-1">
            Editable content for the "Documentation by Design" section on Home. Empty fields fall back to placeholder text.
          </p>
        </div>

        {/* Text content */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">Text content</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Eyebrow label</label>
              <input className={inputCls} value={form.eyebrowText} onChange={(e) => setField("eyebrowText", e.target.value)} placeholder="DOCUMENTATION BY DESIGN" />
            </div>
            <div>
              <label className={labelCls}>Card badge</label>
              <input className={inputCls} value={form.cardBadge} onChange={(e) => setField("cardBadge", e.target.value)} placeholder="COA-LINKED" />
            </div>
            <div>
              <label className={labelCls}>Heading line 1</label>
              <input className={inputCls} value={form.headingLine1} onChange={(e) => setField("headingLine1", e.target.value)} placeholder="Research-grade integrity," />
            </div>
            <div>
              <label className={labelCls}>Heading line 2</label>
              <input className={inputCls} value={form.headingLine2} onChange={(e) => setField("headingLine2", e.target.value)} placeholder="documented at every layer." />
            </div>
          </div>
          <div>
            <label className={labelCls}>Body text</label>
            <textarea className={`${inputCls} resize-none`} rows={3} value={form.bodyText} onChange={(e) => setField("bodyText", e.target.value)} placeholder="Brighter Days Labs documents every batch with lab-verified data researchers can trust." />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Card subtext</label>
              <input className={inputCls} value={form.cardSubtext} onChange={(e) => setField("cardSubtext", e.target.value)} placeholder="Lot-traceable" />
            </div>
            <div>
              <label className={labelCls}>Card title</label>
              <input className={inputCls} value={form.cardTitle} onChange={(e) => setField("cardTitle", e.target.value)} placeholder="Batch-specific documentation" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Card detail line</label>
            <input className={inputCls} value={form.cardDetail} onChange={(e) => setField("cardDetail", e.target.value)} placeholder="QR access on every vial · ≥98% HPLC verified · US-made, GMP-aligned" />
          </div>
        </div>

        {/* Hero image */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400 mb-3">Hero image</h2>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-xl bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
              {data?.heroImageUrl ? (
                <img src={data.heroImageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={24} className="text-gray-300" />
              )}
            </div>
            <label className="inline-flex items-center gap-2 bg-[#3A9E94] hover:bg-[#2A8E84] text-white text-xs font-semibold px-4 py-2 rounded-xl cursor-pointer transition-colors">
              <Upload size={13} />
              {uploadingImage ? "Uploading..." : "Upload Image"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingImage}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>

        {/* Callouts */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-6">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">Image callouts</h2>
          {callouts.map((c) => (
            <div key={c.n} className="grid sm:grid-cols-[120px_1fr_2fr] gap-3 items-start border-t border-gray-50 pt-4 first:border-0 first:pt-0">
              <div>
                <label className={labelCls}>Position</label>
                <select className={inputCls} value={c.position} onChange={(e) => setCalloutPosition(c.positionField, e.target.value)}>
                  <option value="top">Top</option>
                  <option value="middle">Middle</option>
                  <option value="bottom">Bottom</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Callout {c.n} title</label>
                <input className={inputCls} value={c.title} onChange={(e) => setField(c.titleField, e.target.value)} placeholder="Premium Label System" />
              </div>
              <div>
                <label className={labelCls}>Callout {c.n} description</label>
                <input className={inputCls} value={c.description} onChange={(e) => setField(c.descriptionField, e.target.value)} placeholder="Category-coded for rapid identification at a distance." />
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={() => updateMutation.mutate(form)}
          disabled={updateMutation.isPending}
          className="flex items-center gap-2 bg-[#3A9E94] hover:bg-[#2A8E84] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors"
        >
          <Save size={15} />
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </AdminLayout>
  );
}
