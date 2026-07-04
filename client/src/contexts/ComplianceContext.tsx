import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { useLocation } from "wouter";

const SESSION_KEY = "complianceAccepted";

interface ComplianceContextValue {
  isModalOpen: boolean;
  requestCheckout: () => void;
  accept: () => void;
  decline: () => void;
}

const ComplianceContext = createContext<ComplianceContextValue | null>(null);

export function ComplianceProvider({ children }: { children: ReactNode }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [, navigate] = useLocation();

  const requestCheckout = useCallback(() => {
    if (sessionStorage.getItem(SESSION_KEY)) {
      navigate("/checkout");
    } else {
      setIsModalOpen(true);
    }
  }, [navigate]);

  const accept = useCallback(() => {
    sessionStorage.setItem(SESSION_KEY, "1");
    setIsModalOpen(false);
    navigate("/checkout");
  }, [navigate]);

  const decline = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return (
    <ComplianceContext.Provider value={{ isModalOpen, requestCheckout, accept, decline }}>
      {children}
    </ComplianceContext.Provider>
  );
}

export function useCompliance() {
  const ctx = useContext(ComplianceContext);
  if (!ctx) throw new Error("useCompliance must be used within ComplianceProvider");
  return ctx;
}
