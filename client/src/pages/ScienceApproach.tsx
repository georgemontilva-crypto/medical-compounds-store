import { useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Reveal from "@/components/Reveal";
import { VialPlaceholder } from "@/components/ProductCard";
import { useInView } from "@/hooks/useInView";
import { ArrowRight, Check, X } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

const PROCUREMENT_ROWS: Array<{ step: string; traditional: boolean; brighterDays: boolean }> = [
  { step: "Real-time pricing, no quote request", traditional: false, brighterDays: true },
  { step: "Checkout online, no purchase order required", traditional: false, brighterDays: true },
  { step: "Instant order confirmation", traditional: false, brighterDays: true },
  { step: "COA included with every batch, no request needed", traditional: false, brighterDays: true },
  { step: "One-click reorder from order history", traditional: false, brighterDays: true },
];

const PURITY_DATA = [
  { label: "Unverified samples", value: 62, fill: "#d1d5db" },
  { label: "Typical lab-grade", value: 91, fill: "#9ca3af" },
  { label: "Premium peer batch", value: 95, fill: "#7ECDC4" },
  { label: "Brighter Days Labs batch", value: 98, fill: "#3A9E94" },
];

function CategoryDonut({ categories, total }: { categories: Array<{ name: string; color: string; count: number }>; total: number }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  const data = categories.filter((c) => c.count > 0);

  return (
    <div ref={ref} className="relative w-full max-w-[320px] mx-auto aspect-square">
      {inView && (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="name"
              innerRadius="58%"
              outerRadius="88%"
              paddingAngle={2}
              startAngle={90}
              endAngle={450}
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out"
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} stroke="none" />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-4xl font-extrabold text-gray-950">{total}</span>
        <span className="text-xs font-semibold tracking-widest uppercase text-gray-400 mt-1">Compounds</span>
      </div>
    </div>
  );
}

function PurityBarChart() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  return (
    <div ref={ref} className="w-full" style={{ height: 220 }}>
      {inView && (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={PURITY_DATA} layout="vertical" margin={{ left: 12, right: 40, top: 8, bottom: 8 }}>
            <CartesianGrid horizontal={false} stroke="#e5e7eb" />
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis type="category" dataKey="label" width={140} tick={{ fill: "#4b5563", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Bar dataKey="value" radius={[0, 6, 6, 0]} isAnimationActive animationDuration={900} animationEasing="ease-out" barSize={22}>
              {PURITY_DATA.map((entry) => (
                <Cell key={entry.label} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function ScienceApproach() {
  const { data: categories = [] } = trpc.categories.list.useQuery();
  const { data: products = [] } = trpc.products.list.useQuery();
  const { data: documentationImage } = trpc.siteImages.getBySlot.useQuery({
    slotKey: "approach_documentation_image",
  });

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [categories]
  );

  const categoryData = useMemo(
    () =>
      sortedCategories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        color: cat.color || "#6366f1",
        tagline: cat.tagline,
        count: products.filter((p) => p.categoryId === cat.id).length,
      })),
    [sortedCategories, products]
  );

  const totalCompounds = products.length;

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <Reveal>
        <section className="bg-[#f8f8fa] py-16 lg:py-24">
          <div className="container grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-[#3A9E94] mb-4">Our Approach</p>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-950 leading-tight mb-5">
                Organized by mechanism.
                <br />
                Accessible by design.
              </h1>
              <p className="text-gray-500 text-base leading-relaxed mb-8 max-w-lg">
                Brighter Days Labs organizes its catalog by biological mechanism of action, not alphabetically and
                not by popularity. Every category groups compounds researchers actually study together, and every
                batch ships with its own documentation.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 max-w-lg">
                {[
                  { label: "Categories", value: String(sortedCategories.length) },
                  { label: "Compounds", value: String(totalCompounds) },
                  { label: "Direct purchase", value: "Yes" },
                  { label: "Purity floor", value: "≥98%" },
                ].map((m) => (
                  <div key={m.label}>
                    <p className="text-2xl font-extrabold text-gray-950">{m.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2.5 mb-8">
                {[
                  "Organized by mechanism — not by marketing trend or popularity",
                  "Direct purchase, no purchasing department required",
                ].map((line) => (
                  <div key={line} className="flex items-start gap-2.5">
                    <Check size={16} className="text-[#3A9E94] mt-0.5 shrink-0" />
                    <span className="text-sm text-gray-600">{line}</span>
                  </div>
                ))}
              </div>

              <Link href="/compounds">
                <button className="inline-flex items-center gap-2 bg-[#3A9E94] hover:bg-[#2A8E84] text-white font-semibold text-sm px-6 py-3 rounded-full transition-all active:scale-[0.97]">
                  Browse the catalog
                  <ArrowRight size={15} />
                </button>
              </Link>
            </div>

            <CategoryDonut categories={categoryData} total={totalCompounds} />
          </div>
        </section>
      </Reveal>

      {/* ── 01 · MECHANISM-BASED ORGANIZATION ───────────────────────────── */}
      <Reveal>
        <section className="bg-[#0a0a0f] py-20">
          <div className="container">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-mono text-[#7ECDC4]">01</span>
              <span className="text-xs font-semibold tracking-widest uppercase text-white/40">System</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white mb-4 max-w-2xl">
              Mechanism-based organization
            </h2>
            <p className="text-white/60 text-sm leading-relaxed max-w-2xl mb-12">
              Instead of sorting compounds by popularity or an alphabetical list, every category on Brighter Days
              Labs groups compounds by the biological system they act on. Researchers studying a given mechanism can
              see everything relevant to that system in one place.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {categoryData.map((cat) => (
                <div key={cat.id} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full mb-3"
                    style={{ backgroundColor: cat.color }}
                  />
                  <p className="font-bold text-white text-sm mb-1.5">{cat.name}</p>
                  <p className="text-white/50 text-xs leading-relaxed mb-4 line-clamp-3">
                    {cat.tagline || "Research-grade compounds grouped by mechanism of action."}
                  </p>
                  <p className="text-[11px] font-semibold text-white/30">
                    {cat.count} compound{cat.count !== 1 ? "s" : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── 02 · DIRECT SOURCING WITHOUT FRICTION ───────────────────────── */}
      <Reveal>
        <section className="bg-white py-20">
          <div className="container max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-mono text-[#3A9E94]">02</span>
              <span className="text-xs font-semibold tracking-widest uppercase text-gray-400">Access</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-gray-950 mb-4">
              Direct sourcing without institutional friction
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-10">
              Traditional procurement channels add steps that have nothing to do with the research itself. Brighter
              Days Labs is self-serve end to end — researchers order directly, without a purchasing department in
              between.
            </p>

            <div className="border border-gray-100 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto] bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <div className="px-5 py-3">Step</div>
                <div className="px-5 py-3 text-center">Traditional procurement</div>
                <div className="px-5 py-3 text-center">Brighter Days Labs</div>
              </div>
              {PROCUREMENT_ROWS.map((row, i) => (
                <div
                  key={row.step}
                  className={`grid grid-cols-[1fr_auto_auto] items-center ${i !== 0 ? "border-t border-gray-100" : ""}`}
                >
                  <div className="px-5 py-4 text-sm text-gray-700">{row.step}</div>
                  <div className="px-5 py-4 flex justify-center">
                    {row.traditional ? (
                      <Check size={16} className="text-[#3A9E94]" />
                    ) : (
                      <X size={16} className="text-gray-300" />
                    )}
                  </div>
                  <div className="px-5 py-4 flex justify-center">
                    {row.brighterDays ? (
                      <Check size={16} className="text-[#3A9E94]" />
                    ) : (
                      <X size={16} className="text-gray-300" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── 03 · PREMIUM DOCUMENTATION AS A TRUST SIGNAL ────────────────── */}
      <Reveal>
        <section className="bg-[#0a0a0f] py-20">
          <div className="container grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-mono text-[#7ECDC4]">03</span>
                <span className="text-xs font-semibold tracking-widest uppercase text-white/40">Documentation</span>
              </div>
              <h2 className="text-2xl lg:text-3xl font-extrabold text-white mb-4">
                Premium documentation as a trust signal
              </h2>
              <p className="text-white/60 text-sm leading-relaxed">
                Every compound ships with a lot-specific label and a matching Certificate of Analysis. Researchers
                can trace a given vial back to its batch data instead of relying on a generic product page.
              </p>
            </div>
            {documentationImage?.url ? (
              <div className="w-full aspect-[661/281] rounded-3xl overflow-hidden">
                <img
                  src={documentationImage.url}
                  alt="Batch documentation and lot-specific labeling"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-40 mx-auto">
                <VialPlaceholder label="BPC-157" size="10mg" color="#7ECDC4" />
              </div>
            )}
          </div>
        </section>
      </Reveal>

      {/* ── 04 · THE PURITY STANDARD ─────────────────────────────────────── */}
      <Reveal>
        <section className="bg-white py-20">
          <div className="container max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-mono text-[#3A9E94]">04</span>
              <span className="text-xs font-semibold tracking-widest uppercase text-gray-400">Standard</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-gray-950 mb-4">The purity standard</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-10 max-w-xl">
              Purity floors vary widely across suppliers. Brighter Days Labs sets ≥98% HPLC-verified purity as the
              minimum bar for every batch that ships — illustrated below against typical benchmarks.
            </p>
            <PurityBarChart />
          </div>
        </section>
      </Reveal>

      {/* ── CIERRE · RESEARCH USE ONLY ───────────────────────────────────── */}
      <Reveal>
        <section className="bg-[#0a0a0f] py-16">
          <div className="container max-w-2xl text-center">
            <p className="text-xs font-semibold tracking-widest uppercase text-white/40 mb-3">Research Use Only</p>
            <p className="text-white/50 text-sm leading-relaxed">
              For research purposes only. Not for human consumption. All compounds are intended for laboratory use.
            </p>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
