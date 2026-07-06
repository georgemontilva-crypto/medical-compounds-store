import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuthContext } from "./AuthContext";

const SESSION_KEY = "complianceAccepted";
export const CHECKOUT_OFFER_PENDING_KEY = "checkoutOfferPending";

interface NewCustomerOffer {
  id: number;
  code: string;
  type: "percentage" | "fixed";
  value: number;
}

interface ComplianceContextValue {
  isModalOpen: boolean;
  requestCheckout: () => void;
  accept: () => void;
  decline: () => void;
  isGuestModalOpen: boolean;
  newCustomerOffer: NewCustomerOffer | null | undefined;
  continueAsGuest: () => void;
  goRegisterForOffer: () => void;
  closeGuestModal: () => void;
}

const ComplianceContext = createContext<ComplianceContextValue | null>(null);

export function ComplianceProvider({ children }: { children: ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGuestModalOpen, setIsGuestModalOpen] = useState(false);
  const [proceedRequested, setProceedRequested] = useState(false);
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuthContext();
  const { data: newCustomerOffer, isLoading: isOfferLoading } = trpc.coupons.getActiveNewCustomerOffer.useQuery();

  // Decides whether to show the guest-or-register modal or go straight to checkout.
  // Only call once the offer query has resolved — see proceedPastCompliance below.
  const decideCheckoutPath = useCallback(() => {
    if (!isAuthenticated && newCustomerOffer) {
      setIsGuestModalOpen(true);
    } else {
      navigate("/checkout");
    }
  }, [isAuthenticated, newCustomerOffer, navigate]);

  const proceedPastCompliance = useCallback(() => {
    if (isOfferLoading) {
      // Defer the decision until the active-offer query resolves, so a fast click
      // right after page load can't slip past the modal before we know if it applies.
      setProceedRequested(true);
    } else {
      decideCheckoutPath();
    }
  }, [isOfferLoading, decideCheckoutPath]);

  useEffect(() => {
    if (proceedRequested && !isOfferLoading) {
      setProceedRequested(false);
      decideCheckoutPath();
    }
  }, [proceedRequested, isOfferLoading, decideCheckoutPath]);

  const requestCheckout = useCallback(() => {
    if (sessionStorage.getItem(SESSION_KEY)) {
      proceedPastCompliance();
    } else {
      setIsModalOpen(true);
    }
  }, [proceedPastCompliance]);

  const accept = useCallback(() => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setIsModalOpen(false);
    proceedPastCompliance();
  }, [proceedPastCompliance]);

  const decline = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const continueAsGuest = useCallback(() => {
    setIsGuestModalOpen(false);
    navigate("/checkout");
  }, [navigate]);

  const goRegisterForOffer = useCallback(() => {
    setIsGuestModalOpen(false);
    sessionStorage.setItem(CHECKOUT_OFFER_PENDING_KEY, "1");
    navigate("/register");
  }, [navigate]);

  const closeGuestModal = useCallback(() => {
    setIsGuestModalOpen(false);
  }, []);

  return (
    <ComplianceContext.Provider
      value={{
        isModalOpen,
        requestCheckout,
        accept,
        decline,
        isGuestModalOpen,
        newCustomerOffer,
        continueAsGuest,
        goRegisterForOffer,
        closeGuestModal,
      }}
    >
      {children}
    </ComplianceContext.Provider>
  );
}

export function useCompliance() {
  const ctx = useContext(ComplianceContext);
  if (!ctx) throw new Error("useCompliance must be used within ComplianceProvider");
  return ctx;
}
