import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { getPublicEnv } from "../lib/env";
import { getSupabaseBrowserClient } from "../lib/supabase";
import { AuthContext, type AuthState } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = getPublicEnv().configured;
  const [loading, setLoading] = useState(configured);
  const [session, setSession] = useState<Session | null>(null);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  if (fatalError) {
    throw fatalError;
  }

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) {
          setSession(data.session);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFatalError(new Error("We could not restore your session. Reload and sign in again."));
          setLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      configured,
      loading,
      session,
      user: session?.user ?? null,
      signIn: async (email, password) => {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          return "Supabase is not configured.";
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error?.message ?? null;
      },
      signUp: async (email, password) => {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          return "Supabase is not configured.";
        }
        const { error } = await supabase.auth.signUp({ email, password });
        return error?.message ?? null;
      },
      signOut: async () => {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          return;
        }
        await supabase.auth.signOut();
      },
    }),
    [configured, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
