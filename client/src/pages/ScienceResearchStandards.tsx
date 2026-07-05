import { useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Reveal from "@/components/Reveal";
import { useInView } from "@/hooks/useInView";
import { ArrowRight, Check, FileCheck, Beaker } from "lucide-react";
import ReadyToStartBanner from "@/components/ReadyToStartBanner";

// Illustrative — the first four funnel steps aren't backed by real counts.
// Only the last step ("Live in catalog") is real (active product count).
const FUNNEL_PREFIX = [
  { label: "Candidates reviewed", value: 340 },
  { label: "Passed literature reference check", value: 210 },
  { label: "Passed synthesis feasibility", value: 140 },
  { label: "Passed purity threshold", value: 45 },
];

const ILLUSTRATIVE_COAS = [
  { title: "BPC-157 — Batch 24A", product: "BPC-157", batch: "24A-0619", date: "Jun 19, 2026" },
  { title: "NAD+ — Batch 24C", product: "NAD+", batch: "24C-0702", date: "Jul 2, 2026" },
  { title: "TB-500 — Batch 24B", product: "TB-500", batch: "24B-0627", date: "Jun 27, 2026" },
];

const STANDARDS_SUMMARY = [
  "Every batch documented before it's listed for sale",
  "Categorization reflects mechanism of action, not marketing",
  "COAs accessible without creating an account",
  "Lot numbers trace back to synthesis and testing records",
];

function SelectionFunnel({ steps }: { steps: Array<{ label: string; value: number }> }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.2);
  const max = steps[0]?.value || 1;

  return (
    <div ref={ref} className="space-y-4 max-w-2xl">
      {steps.map((step, i) => {
        const pct = Math.max(8, (step.value / max) * 100);
        return (
          <div key={step.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-white/70">{step.label}</span>
              <span className="text-sm font-bold text-white">{step.value}</span>
            </div>
            <div className="h-3 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#d3c4ab] to-[#dbcfba] rounded-full transition-all duration-[1200ms] ease-out"
                style={{ width: inView ? `${pct}%` : "0%", transitionDelay: `${i * 120}ms` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ScienceResearchStandards() {
  const { data: heroImage } = trpc.siteImages.getBySlot.useQuery({ slotKey: "research_standards_hero_image" });
  const { data: categories = [] } = trpc.categories.list.useQuery();
  const { data: products = [] } = trpc.products.list.useQuery();
  const { data: recentReports = [] } = trpc.labReports.recent.useQuery({ limit: 6 });

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [categories]
  );

  const categoryRows = useMemo(
    () =>
      sortedCategories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        color: cat.color || "#6366f1",
        badgeCode: cat.badgeCode || cat.name.slice(0, 3).toUpperCase(),
        count: products.filter((p) => p.categoryId === cat.id).length,
      })),
    [sortedCategories, products]
  );

  const funnelSteps = useMemo(
    () => [...FUNNEL_PREFIX, { label: "Live in catalog", value: products.length }],
    [products]
  );

  const labelingRows = useMemo(() => {
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    return products.slice(0, 6).map((p) => {
      const hasCas = !!p.casNumber;
      const hasMechanism = !!p.mechanism;
      const status = hasCas && hasMechanism ? "Documented" : hasCas || hasMechanism ? "Partial" : "—";
      return {
        id: p.id,
        name: p.name,
        categoryName: p.categoryId ? categoryById.get(p.categoryId)?.name || "—" : "—",
        status,
      };
    });
  }, [products, categories]);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <Reveal>
        <section className="bg-[#f8f8fa] py-16 lg:py-24">
          <div className="container grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-[#d3c4ab] mb-4">
                Research Standards
              </p>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-950 leading-tight mb-5">
                What serious researchers
                <br />
                should expect from a supply partner.
              </h1>
              <p className="text-gray-500 text-base leading-relaxed mb-8 max-w-lg">
                Compound sourcing isn't a commodity decision. Documentation depth, labeling precision, and how
                rigorously a catalog is categorized all affect whether the data you get back is usable. Brighter
                Days Labs holds itself to a documented standard on all three.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 max-w-lg">
                {[
                  { label: "Documentation standard", value: "Required" },
                  { label: "COA access", value: "No sign-up" },
                  { label: "Categorization", value: "Mechanism-based" },
                  { label: "Update frequency", value: "Per batch" },
                ].map((m) => (
                  <div key={m.label}>
                    <p className="text-lg font-extrabold text-gray-950">{m.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2.5 mb-8">
                {[
                  "Every listed compound has a documented selection rationale",
                  "COAs are public — no account or sales call required to view one",
                ].map((line) => (
                  <div key={line} className="flex items-start gap-2.5">
                    <Check size={16} className="text-[#d3c4ab] mt-0.5 shrink-0" />
                    <span className="text-sm text-gray-600">{line}</span>
                  </div>
                ))}
              </div>

              <Link href="/compounds">
                <button className="inline-flex items-center gap-2 bg-[#d3c4ab] hover:bg-[#baac96] text-white font-semibold text-sm px-6 py-3 rounded-full transition-all active:scale-[0.97]">
                  Browse the catalog
                  <ArrowRight size={15} />
                </button>
              </Link>
            </div>

            <div className="relative rounded-3xl overflow-hidden h-72 lg:h-[420px] bg-gradient-to-br from-[#dbcfba]/20 to-[#0a0a0f]">
              {heroImage?.url ? (
                <img src={heroImage.url} alt="Research documentation standards" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <FileCheck size={64} className="text-white/20" />
                </div>
              )}
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── 01 · COMPOUND SELECTION CRITERIA ─────────────────────────────── */}
      <Reveal>
        <section className="bg-[#0a0a0f] py-20">
          <div className="container">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-mono text-[#dbcfba]">01</span>
              <span className="text-xs font-semibold tracking-widest uppercase text-white/40">Selection</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white mb-4 max-w-2xl">
              Compound selection criteria
            </h2>
            <p className="text-white/60 text-sm leading-relaxed max-w-2xl mb-12">
              Not every candidate compound makes it into the catalog. Each one is reviewed against literature
              references, synthesis feasibility, and a purity threshold before it's ever listed for sale.
            </p>
            <SelectionFunnel steps={funnelSteps} />
          </div>
        </section>
      </Reveal>

      {/* ── 02 · MECHANISM-BASED TAXONOMY ────────────────────────────────── */}
      <Reveal>
        <section className="bg-white py-20">
          <div className="container max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-mono text-[#d3c4ab]">02</span>
              <span className="text-xs font-semibold tracking-widest uppercase text-gray-400">Taxonomy</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-gray-950 mb-4">Mechanism-based taxonomy</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-10 max-w-xl">
              Every category below groups compounds by the biological system they act on, not by an arbitrary
              catalog order.
            </p>

            <div className="border border-gray-100 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_auto] bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <div className="px-5 py-3">Code</div>
                <div className="px-5 py-3">Category</div>
                <div className="px-5 py-3 text-right">Compounds</div>
              </div>
              {categoryRows.map((cat, i) => (
                <div
                  key={cat.id}
                  className={`grid grid-cols-[auto_1fr_auto] items-center ${i !== 0 ? "border-t border-gray-100" : ""}`}
                >
                  <div className="px-5 py-4">
                    <span
                      className="text-xs font-bold px-2 py-1 rounded-full whitespace-nowrap"
                      style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
                    >
                      {cat.badgeCode}
                    </span>
                  </div>
                  <div className="px-5 py-4 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm font-semibold text-gray-800">{cat.name}</span>
                  </div>
                  <div className="px-5 py-4 text-right text-sm text-gray-500">{cat.count}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── 03 · LABELING PRECISION ───────────────────────────────────────── */}
      <Reveal>
        <section className="bg-[#0a0a0f] py-20">
          <div className="container max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-mono text-[#dbcfba]">03</span>
              <span className="text-xs font-semibold tracking-widest uppercase text-white/40">Labeling</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white mb-4">Labeling precision</h2>
            <p className="text-white/60 text-sm leading-relaxed mb-10 max-w-xl">
              Each compound page carries its CAS number and mechanism of action — not just a generic product
              description.
            </p>

            <div className="border border-white/10 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_auto] bg-white/5 text-xs font-semibold uppercase tracking-wide text-white/40">
                <div className="px-5 py-3">Compound</div>
                <div className="px-5 py-3">Category</div>
                <div className="px-5 py-3 text-right">Documentation</div>
              </div>
              {labelingRows.map((row, i) => (
                <div
                  key={row.id}
                  className={`grid grid-cols-[1fr_1fr_auto] items-center ${i !== 0 ? "border-t border-white/10" : ""}`}
                >
                  <div className="px-5 py-4 text-sm font-semibold text-white">{row.name}</div>
                  <div className="px-5 py-4 text-sm text-white/60">{row.categoryName}</div>
                  <div className="px-5 py-4 text-right">
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                        row.status === "Documented"
                          ? "bg-[#dbcfba]/15 text-[#dbcfba]"
                          : row.status === "Partial"
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-white/5 text-white/30"
                      }`}
                    >
                      {row.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── 04 · COA ACCESSIBILITY AND TRANSPARENCY ──────────────────────── */}
      <Reveal>
        <section className="bg-white py-20">
          <div className="container max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-mono text-[#d3c4ab]">04</span>
              <span className="text-xs font-semibold tracking-widest uppercase text-gray-400">Transparency</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-gray-950 mb-4">
              COA accessibility and transparency
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-6 max-w-xl">
              Certificates of Analysis are published as batches are tested — no account or request needed to view
              one.
            </p>

            {recentReports.length === 0 && (
              <p className="text-xs italic text-gray-400 mb-4">
                Example COAs shown below — real batch reports will appear here as they're uploaded.
              </p>
            )}

            <div className="border border-gray-100 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto] bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <div className="px-5 py-3">Compound</div>
                <div className="px-5 py-3">Batch</div>
                <div className="px-5 py-3 text-right">Date</div>
              </div>
              {(recentReports.length > 0
                ? recentReports.map((r) => ({
                    key: r.id,
                    product: r.productName,
                    batch: r.batchNumber || "—",
                    date: r.testDate
                      ? new Date(r.testDate).toLocaleDateString()
                      : new Date(r.createdAt).toLocaleDateString(),
                  }))
                : ILLUSTRATIVE_COAS.map((c) => ({ key: c.title, product: c.product, batch: c.batch, date: c.date }))
              ).map((row, i) => (
                <div
                  key={row.key}
                  className={`grid grid-cols-[1fr_auto_auto] items-center ${i !== 0 ? "border-t border-gray-100" : ""}`}
                >
                  <div className="px-5 py-4 text-sm font-semibold text-gray-800">{row.product}</div>
                  <div className="px-5 py-4 text-sm font-mono text-gray-500">{row.batch}</div>
                  <div className="px-5 py-4 text-right text-sm text-gray-400">{row.date}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── CIERRE · STANDARDS SUMMARY ────────────────────────────────────── */}
      <Reveal>
        <section className="bg-[#0a0a0f] py-16">
          <div className="container max-w-2xl">
            <div className="flex items-center gap-2 mb-6 justify-center">
              <Beaker size={16} className="text-[#dbcfba]" />
              <p className="text-xs font-semibold tracking-widest uppercase text-white/40">Standards Summary</p>
            </div>
            <div className="space-y-2.5 mb-10">
              {STANDARDS_SUMMARY.map((line) => (
                <div key={line} className="flex items-start gap-2.5 justify-center text-center">
                  <Check size={15} className="text-[#dbcfba] mt-0.5 shrink-0" />
                  <span className="text-sm text-white/70">{line}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      <ReadyToStartBanner />
    </div>
  );
}
