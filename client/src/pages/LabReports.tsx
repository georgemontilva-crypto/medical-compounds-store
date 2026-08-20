import { useParams, Link } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  FileText,
  Download,
  Calendar,
  Hash,
  FlaskConical,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

export default function LabReports() {
  const { slug } = useParams<{ slug: string }>();

  const { data: product, isLoading: productLoading } = trpc.products.bySlug.useQuery(
    { slug: slug ?? "" },
    { enabled: !!slug }
  );

  const { data: reports = [], isLoading: reportsLoading } = trpc.labReports.byProduct.useQuery(
    { productId: product?.id ?? 0 },
    { enabled: !!product?.id }
  );

  const { data: images } = trpc.products.images.useQuery(
    { productId: product?.id ?? 0 },
    { enabled: !!product?.id }
  );
  const productImage = images?.find((img) => img.variationId == null) ?? images?.[0];

  const isLoading = productLoading || reportsLoading;

  if (isLoading) {
    return (
      <div className="flex-1 hex-cream">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex-1 hex-cream">
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <p className="text-gray-500">Product not found.</p>
          <Link href="/compounds">
            <button className="mt-4 font-medium text-sm" style={{color:'#d3c4ab'}}>
              ← Back to Compounds
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const activeReports = reports.filter((r) => r.active);

  return (
    <div className="flex-1 hex-cream">

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Back link */}
        <Link href={`/compounds/${slug}`}>
          <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors mb-8 group">
            <ArrowLeft size={15} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to {product.name}
          </button>
        </Link>

        {/* Header */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 mb-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">
            <div className="flex items-start gap-4 sm:gap-5 flex-1 min-w-0">
              <div
                className={`rounded-2xl flex items-center justify-center shrink-0 overflow-hidden ${productImage ? "h-20 w-20 sm:h-24 sm:w-24" : "h-14 w-14"}`}
                style={productImage ? undefined : { backgroundColor: '#f2ede6' }}
              >
                {productImage ? (
                  <img
                    src={productImage.url}
                    alt={product.name}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <FlaskConical size={24} style={{color:'#d3c4ab'}} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold tracking-widest uppercase" style={{color:'#d3c4ab'}}>
                    Laboratory Analysis
                  </span>
                </div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight break-words">
                  {product.name} — Lab Reports
                </h1>
                {product.casNumber && (
                  <p className="text-sm text-gray-400 mt-1">CAS: {product.casNumber}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full shrink-0 self-start">
              <ShieldCheck size={13} />
              Third-party Tested
            </div>
          </div>

          {/* Trust badges */}
          <div className="mt-6 pt-6 border-t border-gray-50 grid grid-cols-3 gap-2 sm:gap-4">
            {[
              { label: "Purity", value: "≥99%" },
              { label: "Testing", value: "HPLC/MS" },
              { label: "Standards", value: "cGMP-aligned" },
            ].map((b) => (
              <div key={b.label} className="text-center">
                <p className="text-base sm:text-lg font-extrabold text-gray-900">{b.value}</p>
                <p className="text-xs text-gray-400 font-medium mt-0.5">{b.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Reports list */}
        {activeReports.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4">
              <FileText size={28} className="text-gray-300" />
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">
              No lab reports available yet
            </h3>
            <p className="text-sm text-gray-400">
              Lab reports for this compound will be published here once available.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 font-medium px-1">
              {activeReports.length} report{activeReports.length !== 1 ? "s" : ""} available
            </p>
            {activeReports.map((report) => (
              <div
                key={report.id}
                className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow group"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* PDF icon */}
                    <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                      <FileText size={20} className="text-red-500" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 text-base leading-snug break-words">
                        {report.title}
                      </h3>
                      {report.description && (
                        <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                          {report.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
                        {report.batchNumber && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Hash size={11} />
                            <span>Batch: {report.batchNumber}</span>
                          </div>
                        )}
                        {report.testDate && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Calendar size={11} />
                            <span>
                              {new Date(report.testDate).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                        )}
                        {report.fileSize && (
                          <span className="text-xs text-gray-400">
                            {(report.fileSize / 1024 / 1024).toFixed(2)} MB
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 sm:self-start">
                    <a
                      href={report.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-colors" style={{color:'#d3c4ab', backgroundColor:'#f2ede6'}}
                    >
                      <ExternalLink size={14} />
                      View
                    </a>
                    <a
                      href={report.fileUrl}
                      download={report.fileName}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-xl transition-colors"
                    >
                      <Download size={14} />
                      Download
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-10 bg-amber-50 border border-amber-100 rounded-2xl p-5">
          <p className="text-xs text-amber-700 leading-relaxed">
            <strong>Research Use Only.</strong> These laboratory reports are provided for
            informational and research purposes only. All compounds are intended solely for
            in-vitro research and are not approved for human consumption, veterinary use, or
            any clinical application.
          </p>
        </div>
      </div>
    </div>
  );
}
