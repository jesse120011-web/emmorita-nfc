import { createContext } from "react";
import type { MembershipRow } from "../lib/types";

export type TenantState = {
  loading: boolean;
  error: string | null;
  memberships: MembershipRow[];
  active: MembershipRow | null;
  setActiveBusinessId: (id: string) => void;
  createBusiness: (name: string) => Promise<string | null>;
  refresh: () => Promise<void>;
};

export const TenantContext = createContext<TenantState | null>(null);
