import { useContext } from "react";
import { TenantContext, type TenantState } from "./tenant-context";

export function useTenant(): TenantState {
  const ctx = useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenant must be used within TenantProvider");
  }
  return ctx;
}
