import { Link } from "wouter";
import Navbar from "@/components/Navbar";
import { ChevronRight } from "lucide-react";

export interface LegalSection {
  heading: string;
  body: string | string[];
}

interface Props {
  eyebrow?: string;
  title: string;
  lastUpdated?: string;
  intro?: string;
  sections: LegalSection[];
  closingNote?: string;
}

export default function LegalPageLayout({
  eyebrow = "Legal",
  title,
  lastUpdated,
  intro,
  sections,
  closingNote,
}: Props) {
  return (
    <div className="min-h-screen hex-cream relative">
      <div className="absolute inset-0 bg-white/50 md:hidden pointer-events-none" />

      <div className="relative z-10">
        <Navbar />

        <main className="max-w-3xl mx-auto px-4 py-16">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8">
            <Link href="/">
              <span className="hover:text-gray-600 transition-colors cursor-pointer">Home</span>
            </Link>
            <ChevronRight size={14} />
            <span className="text-gray-400">Legal</span>
            <ChevronRight size={14} />
            <span className="text-gray-700 font-medium">{title}</span>
          </nav>

          <p className="text-xs font-semibold tracking-widest uppercase mb-2" style={{ color: "#d3c4ab" }}>
            {eyebrow}
          </p>
          <h1 className="text-4xl font-light text-gray-950 mb-4">{title}</h1>
          {lastUpdated && <p className="text-xs text-gray-400 mb-6">Last updated: {lastUpdated}</p>}
          {intro && <p className="text-gray-600 text-base leading-relaxed mb-10">{intro}</p>}

          <div className="space-y-10">
            {sections.map((s, i) => (
              <section key={i}>
                <h2 className="text-lg font-bold text-gray-950 mb-2">
                  {i + 1}. {s.heading}
                </h2>
                {(Array.isArray(s.body) ? s.body : [s.body]).map((p, pi) => (
                  <p key={pi} className="text-sm text-gray-600 leading-relaxed mt-2 first:mt-0">
                    {p}
                  </p>
                ))}
              </section>
            ))}
          </div>

          {closingNote && (
            <div className="mt-12 pt-8 border-t border-gray-200">
              <p className="text-xs text-gray-400 leading-relaxed italic">{closingNote}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
