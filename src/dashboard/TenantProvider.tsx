import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getSupabaseBrowserClient } from "../lib/supabase";
import { slugify } from "../lib/slug";
import type { MembershipRow } from "../lib/types";

type TenantState = {
  loading: boolean;
  error: string | null;
  memberships: MembershipRow[];
  active: MembershipRow | null;
  setActiveBusinessId: (id: string) => void;
  createBusiness: (name: string) => Promise<string | null>;
  refresh: () => Promise<void>;
};

const TenantContext = createContext<TenantState | null>(null);

type MembershipBusiness = NonNullable<MembershipRow["businesses"]>;
type MembershipQueryRow = Omit<MembershipRow, "businesses"> & {
  businesses: MembershipBusiness[] | null;
};

function normalizeMembership(row: MembershipQueryRow): MembershipRow {
  return {
    ...row,
    businesses: row.businesses?.[0] ?? null,
  };
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      setLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase
      .from("business_members")
      .select("id, business_id, role, businesses(id, name, slug, status, country_code)")
      .is("deleted_at", null)
      .returns<MembershipQueryRow[]>();

    if (queryError) {
      setError(queryError.message);
      setMemberships([]);
    } else {
      const rows = (data ?? []).map(normalizeMembership);
      setMemberships(rows);
      setError(null);
      setActiveId((current) => current ?? rows[0]?.business_id ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<TenantState>(() => {
    const active = memberships.find((row) => row.business_id === activeId) ?? null;
    return {
      loading,
      error,
      memberships,
      active,
      setActiveBusinessId: setActiveId,
      createBusiness: async (name) => {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) {
          return "Supabase is not configured.";
        }
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          return "You must be signed in.";
        }
        const slug = slugify(name);
        if (!slug) {
          return "Enter a business name that can become a URL slug.";
        }
        const { error: insertError } = await supabase.from("businesses").insert({
          owner_id: user.id,
          name: name.trim(),
          slug,
          status: "draft",
        });
        if (insertError) {
          return insertError.message;
        }
        await refresh();
        return null;
      },
      refresh,
    };
  }, [activeId, error, loading, memberships, refresh]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantState {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenant must be used within TenantProvider");
  }
  return ctx;
}
