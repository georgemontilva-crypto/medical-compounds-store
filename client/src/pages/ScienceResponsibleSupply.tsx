import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import Navbar from "@/components/Navbar";
import Reveal from "@/components/Reveal";
import { useInView } from "@/hooks/useInView";
import {
  ArrowRight,
  Check,
  Factory,
  MapPin,
  ShieldCheck,
  Box,
  Layers,
  ClipboardCheck,
  PackageCheck,
  Truck,
} from "lucide-react";
import ReadyToStartBanner from "@/components/ReadyToStartBanner";

const ORIGIN_STATS = [
  { icon: MapPin, label: "Manufacturing origin", value: "United States" },
  { icon: Factory, label: "Facility standard", value: "cGMP-aligned" },
  { icon: ShieldCheck, label: "Import dependency", value: "None" },
];

const DOCUMENTATION_CHECKS = [
  { criterion: "Purity ≥99%", status: "Verified" },
  { criterion: "Identity matches molecular weight", status: "Verified" },
  { criterion: "Mechanism of action documented", status: "Verified" },
  { criterion: "Storage temperature recommendation", status: "Required" },
  { criterion: "Lot traceable to synthesis record", status: "Verified" },
];

const PACKAGING_ITEMS = [
  "Outer shipping carton",
  "Insulated liner (if needed)",
  "Sealed inner vial pouch",
  "Hardcoded vial label",
  "Compound label",
];

const OPERATIONAL_STEPS = [
  { icon: ClipboardCheck, title: "Order received", description: "Order enters the fulfillment queue." },
  { icon: Layers, title: "Pulled from inventory", description: "Lot-specific vials are pulled and checked in." },
  { icon: ShieldCheck, title: "QC check", description: "Label, seal, and lot match are verified before packing." },
  { icon: Box, title: "Packed", description: "Vials go into their sealed pouch and outer carton." },
  { icon: Truck, title: "Shipped", description: "Order leaves with tracking tied to its lot number." },
];

function OperationalTimeline() {
  const { ref, inView } = useInView<HTMLDivElement>(0.2);
  return (
    <div ref={ref} className="relative">
      <div className="hidden sm:block absolute top-6 left-[10%] right-[10%] h-px bg-gray-200">
        <div
          className="h-full bg-[#d3c4ab] transition-all duration-[1400ms] ease-out"
          style={{ width: inView ? "100%" : "0%" }}
        />
      </div>
      <div className="grid sm:grid-cols-5 gap-8 sm:gap-4 relative">
        {OPERATIONAL_STEPS.map((step, i) => (
          <div
            key={step.title}
            className="text-center transition-all duration-500 ease-out"
            style={{
              opacity: inView ? 1 : 0,
              transform: inView ? "translateY(0)" : "translateY(12px)",
              transitionDelay: inView ? `${i * 130}ms` : "0ms",
            }}
          >
            <div className="w-12 h-12 rounded-full bg-white border-2 border-[#d3c4ab] flex items-center justify-center mx-auto mb-3 relative z-10">
              <step.icon size={18} className="text-[#d3c4ab]" />
            </div>
            <p className="font-bold text-gray-900 text-sm mb-1">{step.title}</p>
            <p className="text-gray-500 text-xs leading-relaxed">{step.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ScienceResponsibleSupply() {
  const { data: heroImage } = trpc.siteImages.getBySlot.useQuery({ slotKey: "responsible_supply_hero_image" });

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <Reveal>
        <section className="bg-[#f8f8fa] py-16 lg:py-24">
          <div className="container grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-[#d3c4ab] mb-4">
                Responsible Supply
              </p>
              <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-950 leading-tight mb-5">
                Discipline at every
                <br />
                step of the chain.
              </h1>
              <p className="text-gray-500 text-base leading-relaxed mb-8 max-w-lg">
                Responsible sourcing isn't a marketing line — it's operational control over how a compound is
                manufactured, packaged, and handled before it reaches a researcher's bench. Brighter Days Labs
                treats each of those steps as a discipline with its own standard.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 max-w-lg">
                {[
                  { label: "Origin", value: "Made in USA" },
                  { label: "Packaging", value: "Tamper-evident" },
                  { label: "Batch docs", value: "Required" },
                  { label: "Cold-chain", value: "Not required" },
                ].map((m) => (
                  <div key={m.label}>
                    <p className="text-lg font-extrabold text-gray-950">{m.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2.5 mb-8">
                {[
                  "Synthesized domestically, not dropshipped from an unverified overseas source",
                  "Packaging built for information and integrity, not shelf marketing",
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
                <img src={heroImage.url} alt="Responsible supply chain" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <PackageCheck size={64} className="text-white/20" />
                </div>
              )}
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── 01 · DOMESTIC SYNTHESIS ───────────────────────────────────────── */}
      <Reveal>
        <section className="bg-[#0a0a0f] py-20">
          <div className="container">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-mono text-[#dbcfba]">01</span>
              <span className="text-xs font-semibold tracking-widest uppercase text-white/40">Origin</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white mb-4 max-w-2xl">Domestic synthesis</h2>
            <p className="text-white/60 text-sm leading-relaxed max-w-2xl mb-12">
              Every compound is synthesized in the United States rather than sourced through an unverified
              overseas intermediary. That keeps the manufacturing standard, and the paper trail behind it, under
              one roof instead of scattered across a resale chain.
            </p>

            <div className="grid sm:grid-cols-3 gap-4">
              {ORIGIN_STATS.map((stat) => (
                <div key={stat.label} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-3">
                    <stat.icon size={17} className="text-[#dbcfba]" />
                  </div>
                  <p className="font-bold text-white text-sm mb-1">{stat.value}</p>
                  <p className="text-white/50 text-xs">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── 02 · DOCUMENTATION INTEGRITY ──────────────────────────────────── */}
      <Reveal>
        <section className="bg-white py-20">
          <div className="container max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-mono text-[#d3c4ab]">02</span>
              <span className="text-xs font-semibold tracking-widest uppercase text-gray-400">Integrity</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-gray-950 mb-4">Documentation integrity</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-10 max-w-xl">
              Every batch is checked against the same criteria before it's cleared to ship.
            </p>

            <div className="border border-gray-100 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[1fr_auto] bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <div className="px-5 py-3">Criterion</div>
                <div className="px-5 py-3 text-right">Status</div>
              </div>
              {DOCUMENTATION_CHECKS.map((row, i) => (
                <div
                  key={row.criterion}
                  className={`grid grid-cols-[1fr_auto] items-center ${i !== 0 ? "border-t border-gray-100" : ""}`}
                >
                  <div className="px-5 py-4 text-sm font-semibold text-gray-800">{row.criterion}</div>
                  <div className="px-5 py-4 text-right">
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                        row.status === "Verified"
                          ? "bg-[#f2ede6] text-[#d3c4ab]"
                          : "bg-amber-50 text-amber-600"
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

      {/* ── 03 · PACKAGING CLARITY ────────────────────────────────────────── */}
      <Reveal>
        <section className="bg-[#0a0a0f] py-20">
          <div className="container grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-sm font-mono text-[#dbcfba]">03</span>
                <span className="text-xs font-semibold tracking-widest uppercase text-white/40">Packaging</span>
              </div>
              <h2 className="text-2xl lg:text-3xl font-extrabold text-white mb-4">Packaging clarity</h2>
              <p className="text-white/60 text-sm leading-relaxed">
                Packaging is designed to carry information, not sell shelf appeal — every layer between the vial
                and the shipping box exists to protect the compound or document what's inside it.
              </p>
            </div>
            <div className="space-y-2.5">
              {PACKAGING_ITEMS.map((item) => (
                <div key={item} className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <Check size={15} className="text-[#dbcfba] shrink-0" />
                  <span className="text-sm text-white/80">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── 04 · OPERATIONAL DISCIPLINE ───────────────────────────────────── */}
      <Reveal>
        <section className="bg-white py-20">
          <div className="container">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm font-mono text-[#d3c4ab]">04</span>
              <span className="text-xs font-semibold tracking-widest uppercase text-gray-400">Operations</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-gray-950 mb-4 max-w-2xl">
              Operational discipline
            </h2>
            <p className="text-gray-500 text-sm leading-relaxed max-w-2xl mb-14">
              Inventory handling follows the same sequence for every order, so a compound's chain of custody stays
              intact from the moment it's requested to the moment it ships.
            </p>
            <OperationalTimeline />
          </div>
        </section>
      </Reveal>

      {/* ── CIERRE · HONEST ABOUT WHAT WE ARE ────────────────────────────── */}
      <Reveal>
        <section className="bg-[#0a0a0f] py-16">
          <div className="container max-w-2xl text-center">
            <p className="text-xs font-semibold tracking-widest uppercase text-white/40 mb-4">
              Honest About What We Are
            </p>
            <p className="text-white/60 text-sm leading-relaxed mb-10 max-w-xl mx-auto">
              Brighter Days Labs is a research compound supply company, not a pharmaceutical manufacturer. We don't
              claim clinical indications, and we don't cut corners on documentation to look like one. What we sell
              is a well-documented compound and the paper trail behind it — nothing more, nothing dressed up.
            </p>
          </div>
        </section>
      </Reveal>

      <ReadyToStartBanner />
    </div>
  );
}
