import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Reveal from "@/components/Reveal";
import { VialPlaceholder } from "@/components/ProductCard";
import { useInView } from "@/hooks/useInView";
import { ArrowRight, Check, Layers, Link2, Beaker, PackageCheck } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

const PROCESS_STEPS = [
  { icon: Layers, title: "Resin load", description: "The first amino acid is anchored to a solid support resin." },
  { icon: Link2, title: "Chain assembly", description: "Amino acids are added sequentially to build the full peptide chain." },
  { icon: Beaker, title: "Cleavage + purification", description: "The finished chain is cleaved from resin and purified via HPLC." },
  { icon: PackageCheck, title: "Final product", description: "Purified peptide is lyophilized and staged for batch testing." },
];

const HPLC_DATA = [
  { t: 0, v: 2 },
  { t: 1, v: 3 },
  { t: 2, v: 4 },
  { t: 3, v: 6 },
  { t: 4, v: 10 },
  { t: 5, v: 92 },
  { t: 6, v: 14 },
  { t: 7, v: 6 },
  { t: 8, v: 4 },
  { t: 9, v: 3 },
  { t: 10, v: 2 },
];

const TRACEABILITY_EVENTS = [
  { time: "Day 1 · 08:14", title: "Synthesis started", description: "Resin loaded and chain assembly begins under a unique batch ID." },
  { time: "Day 2 · 16:40", title: "Purification complete", description: "HPLC purification finishes; a sample is pulled for testing." },
  { time: "Day 3 · 11:05", title: "Mass spec complete", description: "Molecular weight is confirmed against the reference standard." },
  { time: "Day 3 · 18:22", title: "Lyophilization complete", description: "Purified peptide is freeze-dried into its final powder form." },
  { time: "Day 4 · 09:50", title: "COA generated", description: "The Certificate of Analysis is generated and linked to the lot number." },
  { time: "Day 4 · 14:00", title: "Ready to ship", description: "The batch is labeled, logged, and cleared for order fulfillment." },
];

const CLOSING_STATS = [
  { label: "Made in USA" },
  { label: "≥98% purity" },
  { label: "Per-batch COA" },
  { label: "cGMP-aligned facility" },
];

function ProcessDiagram() {
  const { ref, inView } = useInView<HTMLDivElement>(0.2);
  return (
    <div ref={ref} className="relative">
      <div className="hidden sm:block absolute top-6 left-[12.5%] right-[12.5%] h-px bg-white/10">
        <div
          className="h-full bg-[#7ECDC4] transition-all duration-[1400ms] ease-out"
          style={{ width: inView ? "100%" : "0%" }}
        />
      </div>
      <div className="grid sm:grid-cols-4 gap-8 sm:gap-4 relative">
        {PROCESS_STEPS.map((step, i) => (
          <div
            key={step.title}
            className="text-center transition-all duration-500 ease-out"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? "translateY(0)" : "translateY(12px)",
              transitionDelay: inView ? `${i * 150}ms` : "0ms",
            }}
          >
            <div className="w-12 h-12 rounded-full bg-[#0a0a0f] border-2 border-[#7ECDC4] flex items-center justify-center mx-auto mb-3 relative z-10">
              <step.icon size={18} className="text-[#7ECDC4]" />
            </div>
            <p className="font-bold text-white text-sm mb-1">{step.title}</p>
            <p className="text-white/50 text-xs leading-relaxed">{step.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function HplcChart() {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  return (
    <div ref={ref} className="relative w-full" style={{ height: 240 }}>
      {inView && (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={HPLC_DATA} margin={{ top: 36, right: 16, left: 16, bottom: 10 }}>
            <Line
              type="monotone"
              dataKey="v"
              stroke="#7ECDC4"
              strokeWidth={2}
              dot={false}
              isAnimationActive
              animationDuration={1400}
              animationEasing="ease-out"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none">
        <span className="text-xs font-bold text-[#7ECDC4]">≥98% purity</span>
      </div>
    </div>
  );
}

export default function ScienceManufacturing() {
  const { data: heroImage } = trpc.siteImages.getBySlot.useQuery({ slotKey: "manufacturing_hero_image" });

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <Reveal>
        <section className="bg-[#f8f8fa] py-16 lg:py-24">
          <div className="container grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-[#3A9E94] mb-4">
                Manufacturing Standards
              </p>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-950 leading-tight mb-5">
                US-based synthesis
                <br />
                with batch-level accountability.
              </h1>
              <p className="text-gray-500 text-base leading-relaxed mb-8 max-w-lg">
                Every compound Brighter Days Labs sells is synthesized and tested under documented process
                controls. Sourcing, purification, and quality checks are tracked at the batch level, so a given
                vial can always be traced back to how and when it was made.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 max-w-lg">
                {[
                  { label: "Made in", value: "USA" },
                  { label: "Certificate of Analysis", value: "Every order" },
                  { label: "Independently tested", value: "Every batch" },
                  { label: "Lot number", value: "Tied to order" },
                ].map((m) => (
                  <div key={m.label}>
                    <p className="text-lg font-extrabold text-gray-950">{m.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2.5 mb-8">
                {[
                  "Every batch independently tested before it ships",
                  "Lot numbers trace back to synthesis and purification records",
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

            <div className="relative rounded-3xl overflow-hidden h-72 lg:h-[420px] bg-gradient-to-br from-[#7ECDC4]/20 to-[#0a0a0f]">
              {heroImage?.url ? (
                <img src={heroImage.url} alt="Manufacturing facility" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Beaker size={64} className="text-white/20" />
                </div>
              )}
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── 01 · SOLID-PHASE PEPTIDE SYNTHESIS ───────────────────────────── */}
      <Reveal>
        <section className="bg-[#0a0a0f] py-20">
          <div className="container">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-mono text-[#7ECDC4]">01</span>
              <span className="text-xs font-semibold tracking-widest uppercase text-white/40">Process</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white mb-4 max-w-2xl">
              Solid-phase peptide synthesis
            </h2>
            <p className="text-white/60 text-sm leading-relaxed max-w-2xl mb-14">
              Each compound is built one amino acid at a time on a solid support, then cleaved, purified, and
              staged for testing. The same four stages apply to every batch, regardless of compound.
            </p>
            <ProcessDiagram />
          </div>
        </section>
      </Reveal>

      {/* ── 02 · LYOPHILIZATION AND FORMULATION ──────────────────────────── */}
      <Reveal>
        <section className="bg-white py-20">
          <div className="container grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-mono text-[#3A9E94]">02</span>
                <span className="text-xs font-semibold tracking-widest uppercase text-gray-400">Formulation</span>
              </div>
              <h2 className="text-2xl lg:text-3xl font-extrabold text-gray-950 mb-4">
                Lyophilization and formulation
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed">
                After purification, compounds are freeze-dried into a stable lyophilized powder rather than shipped
                in solution. This keeps the product stable during shipping and storage, and each vial is labeled
                with its compound, size, and batch reference at the point of formulation.
              </p>
            </div>
            <div className="w-40 mx-auto">
              <VialPlaceholder label="NAD+" size="500mg" color="#3A9E94" />
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── 03 · INDEPENDENT ANALYTICAL TESTING ──────────────────────────── */}
      <Reveal>
        <section className="bg-[#0a0a0f] py-20">
          <div className="container max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-mono text-[#7ECDC4]">03</span>
              <span className="text-xs font-semibold tracking-widest uppercase text-white/40">Testing</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white mb-4">
              Independent analytical testing
            </h2>
            <p className="text-white/60 text-sm leading-relaxed mb-10 max-w-xl">
              Every batch is run through HPLC analysis to confirm purity before it's cleared to ship. The
              illustrative trace below shows the kind of sharp, well-resolved peak a high-purity batch produces.
            </p>
            <HplcChart />
          </div>
        </section>
      </Reveal>

      {/* ── 04 · LOT-LEVEL TRACEABILITY ───────────────────────────────────── */}
      <Reveal>
        <section className="bg-white py-20">
          <div className="container max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-mono text-[#3A9E94]">04</span>
              <span className="text-xs font-semibold tracking-widest uppercase text-gray-400">Traceability</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-gray-950 mb-4">Lot-level traceability</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-12 max-w-xl">
              Every lot moves through the same recorded checkpoints, illustrated below with representative
              timestamps.
            </p>

            <div className="relative pl-8">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
              <div className="space-y-8">
                {TRACEABILITY_EVENTS.map((event) => (
                  <Reveal key={event.title}>
                    <div className="relative">
                      <span className="absolute -left-8 top-1 w-3.5 h-3.5 rounded-full bg-[#3A9E94] border-4 border-white ring-1 ring-gray-200" />
                      <p className="text-xs font-mono text-gray-400 mb-1">{event.time}</p>
                      <p className="font-bold text-gray-900 text-sm mb-1">{event.title}</p>
                      <p className="text-gray-500 text-xs leading-relaxed">{event.description}</p>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── CIERRE · MANUFACTURING AT A GLANCE ───────────────────────────── */}
      <Reveal>
        <section className="bg-[#0a0a0f] py-16">
          <div className="container max-w-3xl text-center">
            <p className="text-xs font-semibold tracking-widest uppercase text-white/40 mb-8">
              Manufacturing at a Glance
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-12">
              {CLOSING_STATS.map((stat) => (
                <p key={stat.label} className="text-sm font-bold text-white">
                  {stat.label}
                </p>
              ))}
            </div>
            <div className="border-t border-white/10 pt-8">
              <p className="text-xs font-semibold tracking-widest uppercase text-white/40 mb-3">
                Research Use Only
              </p>
              <p className="text-white/50 text-sm leading-relaxed">
                For research purposes only. Not for human consumption. All compounds are intended for laboratory
                use.
              </p>
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
