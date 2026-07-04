import { useState } from "react";
import { useCompliance } from "@/contexts/ComplianceContext";

const COMPLIANCE_POINTS = [
  "I am at least 21 years of age.",
  "I am purchasing only for lawful laboratory research or analytical purposes.",
  "I understand the products are not for human consumption, animal use, veterinary use, therapeutic use, diagnostic use, clinical use, cosmetic use, wellness use, performance enhancement, household use, or personal use.",
  "I understand Brighter Days Labs does not provide dosage, administration, preparation, reconstitution, dilution, medical, veterinary, or clinical guidance.",
  "I represent that I am qualified to receive, handle, store, use, and dispose of laboratory-grade research materials safely and lawfully.",
  "I accept full responsibility for compliance with all applicable laws, regulations, institutional policies, storage requirements, handling requirements, and disposal obligations.",
  "I agree to indemnify and hold harmless Brighter Days Labs for any claim arising from my unauthorized use, misuse, transfer, resale, handling, storage, or disposal of any product.",
];

export default function ComplianceModal() {
  const { isModalOpen, accept, decline } = useCompliance();
  const [agreed, setAgreed] = useState(false);

  if (!isModalOpen) return null;

  function handleDecline() {
    setAgreed(false);
    decline();
  }

  function handleAccept() {
    if (!agreed) return;
    setAgreed(false);
    accept();
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={handleDecline} />

      <div className="relative z-10 w-full max-w-lg bg-white rounded-3xl border border-gray-100 shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
        <p className="text-sm font-bold text-gray-950 leading-relaxed mb-4">
          Before proceeding to checkout, please confirm the following:
        </p>

        <ol className="space-y-3 mb-6 list-decimal list-inside">
          {COMPLIANCE_POINTS.map((point, i) => (
            <li key={i} className="text-sm text-gray-600 leading-relaxed">
              {point}
            </li>
          ))}
        </ol>

        <label className="flex items-start gap-3 mb-6 p-3.5 rounded-xl bg-gray-50 border border-gray-200 cursor-pointer">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-[#3A9E94]"
          />
          <span className="text-sm font-semibold text-gray-800">I agree to all of the above</span>
        </label>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleDecline}
            className="flex-1 text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 px-5 py-3 rounded-full transition-colors"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            disabled={!agreed}
            className="flex-1 text-sm font-semibold bg-[#3A9E94] hover:bg-[#2A8E84] text-white px-5 py-3 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#3A9E94]"
          >
            Continue to Checkout
          </button>
        </div>
      </div>
    </div>
  );
}
