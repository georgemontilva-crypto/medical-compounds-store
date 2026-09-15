import { Link } from "wouter";
import { useState } from "react";
import { FileSearch, FlaskConical, Ruler, Scan, ShieldCheck, ArrowRight } from "lucide-react";
import Reveal from "@/components/Reveal";

/**
 * The advertising landing page.
 *
 * Its content is what a platform reviewer sees when checking whether a
 * sponsored "educational" ad leads somewhere substantive. That sets two
 * constraints the rest of the site does not have: the guide has to be readable
 * without an email address, and nothing on the page may hand the reader to a
 * product offer — a discount, a catalogue link, a checkout path. Reviewers
 * treat that handoff as the ad being product promotion wearing education's
 * clothes, and they are not wrong.
 *
 * Copy is the client's, reproduced rather than rewritten.
 */

const CHECKS = [
  {
    number: "1",
    icon: FileSearch,
    heading: "Identify the sample",
    body: "Find the sample description, lot or batch identifier, report number and relevant dates. Check that these details match the material or document you are reviewing. A report for another sample should not be treated as evidence about yours without an established connection.",
  },
  {
    number: "2",
    icon: FlaskConical,
    heading: "Identify the method",
    body: "Find the test or analytical method and the property being measured. If the report uses an abbreviation, ask the issuing laboratory what it means. Ask whether the method addresses the question you actually need answered.",
  },
  {
    number: "3",
    icon: Ruler,
    heading: "Read the result in context",
    body: "Check the reported value, units and any reference limit or specification. Read the footnotes. Ask the laboratory to explain qualifiers, uncertainty or detection limits where relevant. Do not assume two percentages from different methods describe the same property.",
  },
  {
    number: "4",
    icon: Scan,
    heading: "Understand the scope",
    body: "List what the report covers and what it leaves unanswered. A result from one test should not be treated as the result of a different test. A laboratory report does not, by itself, establish that a material is appropriate for human or animal use.",
  },
  {
    number: "5",
    icon: ShieldCheck,
    heading: "Verify the document",
    body: "Identify the issuing laboratory and its report-verification process. Obtain contact details through an independently verified source. If a report cannot be authenticated or a batch cannot be matched, record the gap and seek clarification before relying on it.",
  },
];

const QUESTIONS = [
  "Does this report cover this exact sample or batch?",
  "What does the method measure?",
  "Which units and limitations apply?",
  "What additional testing, if any, would answer the unresolved question?",
];

export default function EducationReadTheReport() {
  const [email, setEmail] = useState("");
  const [consented, setConsented] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = email.trim().length > 3 && email.includes("@") && consented;

  return (
    <div className="flex-1 hex-cream dark:bg-background">
      {/* Header */}
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-10">
        <p className="text-xs font-semibold tracking-widest uppercase text-[#baac96] mb-3">
          Educational guide
        </p>
        <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-950 leading-tight mb-4 dark:text-white">
          Read the Report
        </h1>
        <p className="text-lg text-gray-500 mb-6 dark:text-gray-400">
          Five checks before interpreting a laboratory result
        </p>
        <p className="text-gray-600 leading-relaxed dark:text-gray-300">
          A certificate of analysis can help document what was tested and what was reported.
          Reading it carefully starts with five practical questions. This guide from Brighter Days
          Labs explains where to look and what to ask when information is missing.
        </p>
      </section>

      {/* The five checks */}
      <section className="max-w-3xl mx-auto px-6 pb-4">
        <div className="space-y-4">
          {CHECKS.map((check) => {
            const Icon = check.icon;
            return (
              <Reveal key={check.number}>
                <div className="lab-card p-6 sm:p-7">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#f2ede6] flex items-center justify-center shrink-0 dark:bg-card">
                      <Icon size={18} className="text-[#baac96]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2.5 mb-2">
                        <span className="text-sm font-mono text-[#d3c4ab]">{check.number}</span>
                        <h2 className="text-lg font-bold text-gray-950 dark:text-white">
                          {check.heading}
                        </h2>
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed dark:text-gray-300">
                        {check.body}
                      </p>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Questions to take back */}
      <section className="max-w-3xl mx-auto px-6 py-10">
        <Reveal>
          <div className="lab-card p-6 sm:p-7">
            <h2 className="text-lg font-bold text-gray-950 mb-4 dark:text-white">
              Questions to take back to the laboratory
            </h2>
            <ul className="space-y-2.5">
              {QUESTIONS.map((q) => (
                <li key={q} className="flex gap-3 text-sm text-gray-600 dark:text-gray-300">
                  <span className="text-[#d3c4ab] shrink-0">→</span>
                  <span>{q}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      {/* Publisher statement — a reviewer looks for this */}
      <section className="max-w-3xl mx-auto px-6 pb-10">
        <p className="text-sm text-gray-500 leading-relaxed dark:text-gray-400">
          Published by Brighter Days Labs, a research materials supplier. This guide provides
          general education about documentation. It is not medical advice or an authorization for
          human or animal use.
        </p>
      </section>

      {/* Optional signup — education only, no product handoff */}
      <section className="max-w-3xl mx-auto px-6 pb-16">
        <Reveal>
          <div className="lab-card p-6 sm:p-7">
            {submitted ? (
              <div className="text-center py-4">
                <p className="font-semibold text-gray-950 mb-1 dark:text-white">
                  You're on the list.
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Future laboratory documentation guides will arrive at {email}.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold text-gray-950 mb-1 dark:text-white">
                  Email me future laboratory documentation guides
                </h2>
                <p className="text-sm text-gray-500 mb-5 dark:text-gray-400">
                  Educational material only. The guide above stays free to read either way.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="email"
                    className="lab-input flex-1"
                    placeholder="you@organization.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={() => setSubmitted(true)}
                    className="btn-primary whitespace-nowrap disabled:opacity-50"
                  >
                    Subscribe to the Guides
                  </button>
                </div>
                <label className="flex items-start gap-2.5 mt-4 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded"
                    checked={consented}
                    onChange={(e) => setConsented(e.target.checked)}
                  />
                  <span className="text-xs text-gray-500 leading-relaxed dark:text-gray-400">
                    I agree to receive educational emails from Brighter Days Labs. I can
                    unsubscribe at any time.
                  </span>
                </label>
              </>
            )}
          </div>
        </Reveal>
      </section>

      {/* Footer links a reviewer checks for */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="pt-6 border-t border-gray-100 dark:border-border flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-400 dark:text-gray-500">
          <Link href="/contact">
            <span className="hover:text-[#baac96] cursor-pointer">Contact</span>
          </Link>
          <Link href="/legal/terms-of-service">
            <span className="hover:text-[#baac96] cursor-pointer">Terms</span>
          </Link>
          <Link href="/legal/website-disclaimer">
            <span className="hover:text-[#baac96] cursor-pointer">Privacy and disclaimer</span>
          </Link>
          <Link href="/legal/research-use-only">
            <span className="hover:text-[#baac96] cursor-pointer inline-flex items-center gap-1">
              Research use policy <ArrowRight size={11} />
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
