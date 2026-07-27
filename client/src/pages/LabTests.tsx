import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import { FileText, Download, ExternalLink, ShieldCheck, Hash, Calendar } from "lucide-react";
import ReadyToStartBanner from "@/components/ReadyToStartBanner";

export default function LabTests() {
  const { data: reports = [], isLoading } = trpc.labReports.recent.useQuery({ limit: 100 });

  return (
    <div className="min-h-screen bg-[#f8f8fa] dark:bg-background">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 sm:p-8 mb-8 shadow-sm dark:bg-card dark:border-border">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">
            <div className="flex items-start gap-4 sm:gap-5 flex-1 min-w-0">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-[#f2ede6] dark:bg-white/10">
                <FileText size={24} className="text-[#d3c4ab]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold tracking-widest uppercase text-[#d3c4ab] mb-1">
                  Laboratory Analysis
                </p>
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight dark:text-white break-words">Lab Tests</h1>
                <p className="text-sm text-gray-500 mt-1 dark:text-gray-400">
                  Certificates of Analysis for every tested batch, published as soon as they're available.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full shrink-0 self-start dark:bg-emerald-500/10 dark:border-emerald-500/20 dark:text-emerald-400">
              <ShieldCheck size={13} />
              Third-party Tested
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-white rounded-2xl border border-gray-100 animate-pulse dark:bg-card dark:border-border" />
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm dark:bg-card dark:border-border">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center mx-auto mb-4 dark:bg-white/10">
              <FileText size={28} className="text-gray-300 dark:text-gray-600" />
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1 dark:text-gray-200">No lab reports available yet</h3>
            <p className="text-sm text-gray-400 max-w-sm mx-auto dark:text-gray-500">
              Certificates of Analysis will be published here as batches are tested. Check back soon, or browse
              the catalog in the meantime.
            </p>
            <Link href="/compounds">
              <button className="mt-5 text-sm font-semibold text-[#d3c4ab] hover:underline">
                Browse the catalog →
              </button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500 font-medium px-1 dark:text-gray-400">
              {reports.length} report{reports.length !== 1 ? "s" : ""} available
            </p>
            {reports.map((report) => (
              <div
                key={report.id}
                className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow dark:bg-card dark:border-border"
              >
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0 dark:bg-red-500/10">
                      <FileText size={20} className="text-red-500 dark:text-red-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#d3c4ab] uppercase tracking-wide mb-0.5">
                        {report.productName}
                      </p>
                      <h3 className="font-semibold text-gray-900 text-base leading-snug break-words dark:text-white">{report.title}</h3>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
                        {report.batchNumber && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                            <Hash size={11} />
                            <span>Batch: {report.batchNumber}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                          <Calendar size={11} />
                          <span>
                            {new Date(report.testDate ?? report.createdAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 sm:self-start">
                    <a
                      href={report.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-colors text-[#d3c4ab] bg-[#f2ede6] hover:bg-[#d9f0ee] dark:bg-white/10 dark:hover:bg-white/15"
                    >
                      <ExternalLink size={14} />
                      View
                    </a>
                    <a
                      href={report.fileUrl}
                      download={report.fileName}
                      className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-800 bg-gray-50 hover:bg-gray-100 px-4 py-2 rounded-xl transition-colors dark:text-gray-300 dark:hover:text-gray-100 dark:bg-white/10 dark:hover:bg-white/15"
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
        <div className="mt-10 bg-amber-50 border border-amber-100 rounded-2xl p-5 dark:bg-amber-500/10 dark:border-amber-500/20">
          <p className="text-xs text-amber-700 leading-relaxed dark:text-amber-400">
            <strong>Research Use Only.</strong> These laboratory reports are provided for informational and
            research purposes only. All compounds are intended solely for in-vitro research and are not approved
            for human consumption, veterinary use, or any clinical application.
          </p>
        </div>
      </main>

      <ReadyToStartBanner />
    </div>
  );
}
