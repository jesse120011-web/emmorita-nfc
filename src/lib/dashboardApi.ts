import { getPublicEnv } from "./env";
import { getSupabaseBrowserClient } from "./supabase";
import type { Branch, Customer, CustomerEventInput, ReputationSettings } from "./types";

export class DashboardApiError extends Error {
  status?: number;
  details?: unknown;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT";
  body?: unknown;
  search?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
};

async function getAccessToken(): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    const err = new DashboardApiError("Supabase is not configured");
    err.status = 503;
    throw err;
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    const err = new DashboardApiError("No active session");
    err.status = 401;
    throw err;
  }
  return token;
}

function buildFunctionsUrl(path: string, search: Record<string, string | number | boolean | null | undefined>): string {
  const env = getPublicEnv();
  if (!env.configured) {
    const err = new DashboardApiError("Public environment is not configured");
    err.status = 503;
    throw err;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null) continue;
    params.append(key, String(value));
  }
  const query = params.toString();
  const base = env.supabaseUrl.replace(/\/$/, "");
  return `${base}/functions/v1/dashboard-api${path}${query ? `?${query}` : ""}`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await getAccessToken();
  const url = buildFunctionsUrl(path, options.search ?? {});

  let res: Response;
  try {
    res = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: getPublicEnv().supabaseAnonKey,
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    const err = new DashboardApiError("Network error while contacting dashboard API");
    err.details = error;
    throw err;
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const err = new DashboardApiError((payload as { error?: string } | null)?.error ?? res.statusText);
    err.status = res.status;
    if (payload && typeof payload === "object" && "details" in (payload as Record<string, unknown>)) {
      err.details = (payload as Record<string, unknown>).details;
    }
    throw err;
  }

  return payload as T;
}

export async function listBranches(businessId: string): Promise<Branch[]> {
  const data = await request<{ branches: Branch[] }>("/branches", { search: { business_id: businessId } });
  return data.branches ?? [];
}

export async function createBranch(businessId: string, payload: Partial<Branch> & { name: string }): Promise<Branch> {
  const data = await request<{ branch: Branch }>("/branches", {
    method: "POST",
    search: { business_id: businessId },
    body: payload,
  });
  return data.branch;
}

export async function updateBranch(
  businessId: string,
  branchId: string,
  updates: Partial<Branch>
): Promise<Branch> {
  const data = await request<{ branch: Branch }>(`/branches/${branchId}`, {
    method: "PATCH",
    search: { business_id: businessId },
    body: updates,
  });
  return data.branch;
}

export async function listCustomers(businessId: string): Promise<Customer[]> {
  const data = await request<{ customers: Customer[] }>("/customers", {
    search: { business_id: businessId },
  });
  return data.customers ?? [];
}

export async function createCustomer(payload: Omit<Customer, "id" | "created_at" | "updated_at">): Promise<Customer> {
  const data = await request<{ customer: Customer }>("/customers", {
    method: "POST",
    body: payload,
  });
  return data.customer;
}

export async function updateCustomer(
  customerId: string,
  payload: Partial<Customer> & { business_id: string }
): Promise<Customer> {
  const data = await request<{ customer: Customer }>(`/customers/${customerId}`, {
    method: "PATCH",
    body: payload,
  });
  return data.customer;
}

export async function createCustomerEvent(event: CustomerEventInput): Promise<void> {
  await request<{ status: string }>("/customers/events", {
    method: "POST",
    body: event,
  });
}

export async function getReputationSettings(businessId: string): Promise<ReputationSettings | null> {
  const data = await request<{ reputation: ReputationSettings | null }>(`/reputation/${businessId}`, {
    method: "GET",
  });
  return data.reputation ?? null;
}

export async function saveReputationSettings(
  businessId: string,
  payload: Partial<ReputationSettings>
): Promise<ReputationSettings> {
  const data = await request<{ reputation: ReputationSettings }>(`/reputation/${businessId}`, {
    method: "PUT",
    body: payload,
  });
  return data.reputation;
}

export async function assignTouchpointBranch(params: {
  businessId: string;
  touchpointId: string;
  branchId: string | null;
}): Promise<{ id: string; business_id: string; branch_id: string | null }> {
  const data = await request<{ touchpoint: { id: string; business_id: string; branch_id: string | null } }>(
    `/touchpoints/${params.touchpointId}/branch`,
    {
      method: "PATCH",
      body: {
        business_id: params.businessId,
        branch_id: params.branchId,
      },
    }
  );
  return data.touchpoint;
}
