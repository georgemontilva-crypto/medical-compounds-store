import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { toast } from "sonner";
import {
  FileText,
  Upload,
  Trash2,
  Plus,
  Hash,
  Calendar,
  Eye,
  EyeOff,
  X,
  FlaskConical,
} from "lucide-react";

export default function AdminLabReports() {
  const utils = trpc.useUtils();
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    batchNumber: "",
    testDate: "",
    fileName: "",
    fileBase64: "",
    fileSize: 0,
  });

  const { data: products = [] } = trpc.products.list.useQuery({});
  const { data: allReports = [], isLoading } = trpc.labReports.all.useQuery();

  const uploadMutation = trpc.labReports.upload.useMutation({
    onSuccess: () => {
      toast.success("Lab report uploaded successfully");
      utils.labReports.all.invalidate();
      setShowUploadForm(false);
      setForm({ title: "", description: "", batchNumber: "", testDate: "", fileName: "", fileBase64: "", fileSize: 0 });
      setSelectedProductId(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.labReports.delete.useMutation({
    onSuccess: () => {
      toast.success("Report deleted");
      utils.labReports.all.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleMutation = trpc.labReports.update.useMutation({
    onSuccess: () => utils.labReports.all.invalidate(),
    onError: (err) => toast.error(err.message),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are allowed");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File must be under 20 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      setForm((f) => ({ ...f, fileBase64: base64, fileName: file.name, fileSize: file.size }));
    };
    reader.readAsDataURL(file);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProductId) { toast.error("Select a product"); return; }
    if (!form.fileBase64) { toast.error("Select a PDF file"); return; }
    if (!form.title.trim()) { toast.error("Title is required"); return; }
    setUploading(true);
    uploadMutation.mutate(
      {
        productId: selectedProductId,
        title: form.title,
        description: form.description || undefined,
        batchNumber: form.batchNumber || undefined,
        testDate: form.testDate || undefined,
        fileBase64: form.fileBase64,
        fileName: form.fileName,
        fileSize: form.fileSize,
      },
      { onSettled: () => setUploading(false) }
    );
  }

  // Group reports by product
  const reportsByProduct = allReports.reduce<Record<number, typeof allReports>>((acc, r) => {
    if (!acc[r.productId]) acc[r.productId] = [];
    acc[r.productId].push(r);
    return acc;
  }, {});

  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  return (
    <AdminLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Lab Reports</h1>
            <p className="text-sm text-gray-500 mt-1">
              Upload and manage Certificate of Analysis (COA) PDFs per product
            </p>
          </div>
          <button
            onClick={() => setShowUploadForm(true)}
            className="flex items-center gap-2 bg-[#3A9E94] hover:bg-[#2A8E84] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            <Plus size={15} />
            Upload Report
          </button>
        </div>

        {/* Upload form modal */}
        {showUploadForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg">
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-900">Upload Lab Report</h2>
                <button
                  onClick={() => setShowUploadForm(false)}
                  className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Product selector */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Product *
                  </label>
                  <select
                    value={selectedProductId ?? ""}
                    onChange={(e) => setSelectedProductId(Number(e.target.value) || null)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7ECDC4]/30 focus:border-[#7ECDC4]"
                    required
                  >
                    <option value="">Select a product...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Report Title *
                  </label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Certificate of Analysis — Batch 2024-01"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7ECDC4]/30 focus:border-[#7ECDC4]"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Optional description or notes..."
                    rows={2}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7ECDC4]/30 focus:border-[#7ECDC4] resize-none"
                  />
                </div>

                {/* Batch + Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                      Batch Number
                    </label>
                    <input
                      type="text"
                      value={form.batchNumber}
                      onChange={(e) => setForm((f) => ({ ...f, batchNumber: e.target.value }))}
                      placeholder="e.g. BPC-2024-01"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7ECDC4]/30 focus:border-[#7ECDC4]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                      Test Date
                    </label>
                    <input
                      type="date"
                      value={form.testDate}
                      onChange={(e) => setForm((f) => ({ ...f, testDate: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#7ECDC4]/30 focus:border-[#7ECDC4]"
                    />
                  </div>
                </div>

                {/* File upload */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    PDF File *
                  </label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
                      form.fileBase64
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-gray-200 hover:border-[#7ECDC4] hover:bg-[#E8F7F6]/30"
                    }`}
                  >
                    {form.fileBase64 ? (
                      <div className="flex items-center justify-center gap-2 text-emerald-700">
                        <FileText size={16} />
                        <span className="text-sm font-medium">{form.fileName}</span>
                        <span className="text-xs text-emerald-500">
                          ({(form.fileSize / 1024).toFixed(0)} KB)
                        </span>
                      </div>
                    ) : (
                      <div>
                        <Upload size={20} className="text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">Click to select PDF</p>
                        <p className="text-xs text-gray-400 mt-1">Max 20 MB</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowUploadForm(false)}
                    className="flex-1 border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || uploadMutation.isPending}
                    className="flex-1 bg-[#3A9E94] hover:bg-[#2A8E84] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                  >
                    {uploading || uploadMutation.isPending ? "Uploading..." : "Upload Report"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reports list */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : Object.keys(reportsByProduct).length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <FileText size={28} className="text-gray-200" />
            </div>
            <p className="text-gray-500 font-medium">No lab reports uploaded yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Click "Upload Report" to add a COA PDF for a product
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(reportsByProduct).map(([productId, reports]) => {
              const product = productMap[Number(productId)];
              return (
                <div key={productId} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                  {/* Product header */}
                  <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-50 bg-gray-50/50">
                    <div className="w-8 h-8 rounded-lg bg-[#E8F7F6] flex items-center justify-center">
                      <FlaskConical size={14} className="text-[#3A9E94]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{product?.name ?? `Product #${productId}`}</p>
                      <p className="text-xs text-gray-400">{reports.length} report{reports.length !== 1 ? "s" : ""}</p>
                    </div>
                  </div>

                  {/* Reports */}
                  <div className="divide-y divide-gray-50">
                    {reports.map((report) => (
                      <div key={report.id} className="flex items-center gap-4 px-6 py-4">
                        <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                          <FileText size={16} className="text-red-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${report.active ? "text-gray-900" : "text-gray-400 line-through"}`}>
                            {report.title}
                          </p>
                          <div className="flex items-center gap-3 mt-0.5">
                            {report.batchNumber && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Hash size={10} /> {report.batchNumber}
                              </span>
                            )}
                            {report.testDate && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Calendar size={10} />
                                {new Date(report.testDate).toLocaleDateString()}
                              </span>
                            )}
                            <span className="text-xs text-gray-400">{report.fileName}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <a
                            href={report.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#3A9E94] hover:text-[#2A8E84] font-medium px-3 py-1.5 rounded-lg hover:bg-[#E8F7F6] transition-colors"
                          >
                            View PDF
                          </a>
                          <button
                            onClick={() => toggleMutation.mutate({ id: report.id, active: !report.active })}
                            className={`p-1.5 rounded-lg transition-colors ${
                              report.active
                                ? "text-emerald-600 hover:bg-emerald-50"
                                : "text-gray-400 hover:bg-gray-100"
                            }`}
                            title={report.active ? "Hide from public" : "Show to public"}
                          >
                            {report.active ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Delete this lab report?")) {
                                deleteMutation.mutate({ id: report.id });
                              }
                            }}
                            className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
