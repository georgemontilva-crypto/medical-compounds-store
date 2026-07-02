import { createContext, useContext, ReactNode } from "react";
import { trpc } from "@/lib/trpc";

interface AuthUser {
  id: number;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, isLoading, refetch } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const typedUser = user as AuthUser | null | undefined;

  return (
    <AuthContext.Provider
      value={{
        user: typedUser ?? null,
        isLoading,
        isAuthenticated: !!typedUser,
        isAdmin: typedUser?.role === "admin",
        refetch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}
