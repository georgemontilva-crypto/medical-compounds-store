import { useCompliance } from "@/contexts/ComplianceContext";

export default function GuestOrRegisterModal() {
  const { isGuestModalOpen, newCustomerOffer, continueAsGuest, goRegisterForOffer, closeGuestModal } =
    useCompliance();

  if (!isGuestModalOpen || !newCustomerOffer) return null;

  const offerLabel =
    newCustomerOffer.type === "percentage"
      ? `${newCustomerOffer.value}% off`
      : `$${newCustomerOffer.value.toFixed(2)} off`;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={closeGuestModal} />

      <div className="relative z-10 w-full max-w-md bg-white rounded-3xl border border-gray-100 shadow-2xl p-8">
        <p className="text-lg font-bold text-gray-950 leading-relaxed mb-2">
          Get {offerLabel} your first order
        </p>
        <p className="text-sm text-gray-600 leading-relaxed mb-6">
          Continue as a guest, or create an account now and get {offerLabel} your first order.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={goRegisterForOffer}
            className="text-sm font-semibold bg-[#d3c4ab] hover:bg-[#baac96] text-white px-5 py-3 rounded-full transition-colors"
          >
            Register & Get Code
          </button>
          <button
            onClick={continueAsGuest}
            className="text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 px-5 py-3 rounded-full transition-colors"
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
