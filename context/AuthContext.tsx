"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { AuthUser } from "@/types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPro: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const fetchUser = useCallback(async () => {
    // Deduplikacja równoległych żądań /api/auth/me (np. przy StrictMode + onAuthStateChange)
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const request = (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        setUser(data.user ?? null);
      } catch {
        setUser(null);
      } finally {
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = request;
    return request;
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/login";
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    // `onAuthStateChange` w @supabase/supabase-js v2 emituje od razu `INITIAL_SESSION`
    // przy subskrypcji, dzięki czemu nie musimy dublować go osobnym `getSession()`.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "INITIAL_SESSION" ||
        event === "SIGNED_IN" ||
        event === "USER_UPDATED"
      ) {
        if (session) {
          fetchUser().finally(() => setIsLoading(false));
        } else {
          setUser(null);
          setIsLoading(false);
        }
      } else if (event === "SIGNED_OUT") {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      isPro:
        user?.profile?.premium_until != null &&
        new Date(user.profile.premium_until) > new Date(),
      logout,
      refreshUser,
    }),
    [user, isLoading, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth musi być używany wewnątrz AuthProvider");
  }
  return context;
}
