import { Link } from "wouter";
import { FlaskConical, ArrowRight, FileText } from "lucide-react";

export default function ReadyToStartBanner() {
  return (
    <section className="py-20 bg-gradient-to-br from-[#0d1a18] via-[#163028] to-[#0a1f18] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
      </div>
      <div className="container relative text-center">
        <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-6">
          <FlaskConical size={24} className="text-white" />
        </div>
        <h2 className="text-3xl lg:text-4xl font-extrabold text-white mb-4">Ready to start your research?</h2>
        <p className="text-[#7ECDC4]/80 text-lg mb-8 max-w-md mx-auto">
          Browse our catalog of ≥98% HPLC purity compounds with batch-specific COAs.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/compounds">
            <button className="inline-flex items-center gap-2 bg-[#7ECDC4] text-[#0d1a18] font-bold px-8 py-3.5 rounded-xl hover:bg-[#5BB8AE] transition-all duration-200 active:scale-[0.98] shadow-xl shadow-black/20">
              Browse Products <ArrowRight size={16} />
            </button>
          </Link>
          <Link href="/lab-tests">
            <button className="inline-flex items-center gap-2 border border-white/20 text-white font-bold px-8 py-3.5 rounded-xl hover:bg-white/10 transition-all duration-200 active:scale-[0.98]">
              <FileText size={16} /> View COA Library
            </button>
          </Link>
        </div>
      </div>
    </section>
  );
}
