import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

type Role = "owner" | "admin" | "staff";

async function getUserIdFromAuth(client: SupabaseClient, req: Request): Promise<string> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    throw new Response("missing bearer token", { status: 401 });
  }
  const token = authHeader.split(" ")[1];
  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user?.id) {
    throw new Response("invalid token", { status: 401 });
  }
  return data.user.id;
}

async function isPlatformAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function requireMembership(
  businessId: string,
  userId: string,
  allowed: Role[]
): Promise<{ role: Role } | never> {
  if (await isPlatformAdmin(userId)) {
    return { role: "admin" };
  }
  const { data, error } = await supabase
    .from("business_members")
    .select("role")
    .eq("business_id", businessId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !allowed.includes(data.role as Role)) {
    throw new Response("forbidden", { status: 403 });
  }
  return { role: data.role as Role };
}

function badRequest(message: string, details?: unknown) {
  return new Response(JSON.stringify({ error: message, details }), { status: 400, headers: JSON_HEADERS });
}

function ok(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

async function ensureBranch(businessId: string, branchId?: string | null): Promise<void> {
  if (!branchId) return;
  const { data, error } = await supabase
    .from("branches")
    .select("business_id")
    .eq("id", branchId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Response("branch_not_found", { status: 404 });
  if (data.business_id !== businessId) {
    throw new Response("branch_mismatch", { status: 400 });
  }
}

async function ensureTouchpoint(businessId: string, touchpointId?: string | null): Promise<void> {
  if (!touchpointId) return;
  const { data, error } = await supabase
    .from("touchpoints")
    .select("business_id")
    .eq("id", touchpointId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Response("touchpoint_not_found", { status: 404 });
  if (data.business_id !== businessId) {
    throw new Response("touchpoint_mismatch", { status: 400 });
  }
}

async function handleBranches(req: Request, userId: string, url: URL) {
  const businessId = url.searchParams.get("business_id");
  if (!businessId) return badRequest("business_id required");
  const method = req.method.toUpperCase();

  if (method === "GET") {
    await requireMembership(businessId, userId, ["owner", "admin", "staff"]);
    const { data, error } = await supabase
      .from("branches")
      .select("id,name,slug,address,city,country_code,timezone,is_default,created_at,updated_at")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return ok({ branches: data ?? [] });
  }

  if (method === "POST") {
    await requireMembership(businessId, userId, ["owner", "admin"]);
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return badRequest("invalid json");
    const name = body.name as string;
    if (!name || name.length < 1 || name.length > 160) return badRequest("name invalid");
    const payload = {
      business_id: businessId,
      name,
      slug: typeof body.slug === "string" && body.slug.length > 0 ? body.slug.toLowerCase() : null,
      address: typeof body.address === "string" ? body.address : null,
      city: typeof body.city === "string" ? body.city : null,
      country_code: typeof body.country_code === "string" && body.country_code.length === 2 ? body.country_code : "KE",
      timezone: typeof body.timezone === "string" && body.timezone.length > 0 ? body.timezone : "Africa/Nairobi",
      is_default: Boolean(body.is_default),
    };
    const { data, error } = await supabase.from("branches").insert(payload).select("*").maybeSingle();
    if (error) return badRequest("insert_failed", error.message);
    return ok({ branch: data }, 201);
  }

  if (method === "PATCH") {
    const pathParts = url.pathname.split("/").filter(Boolean);
    const branchId = pathParts[pathParts.length - 1];
    if (!branchId) return badRequest("branch id required");
    await requireMembership(businessId, userId, ["owner", "admin"]);
    await ensureBranch(businessId, branchId);
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return badRequest("invalid json");
    const updates: Record<string, unknown> = {};
    if (typeof body.name === "string") updates.name = body.name;
    if (typeof body.slug === "string") updates.slug = body.slug.toLowerCase();
    if (typeof body.address === "string") updates.address = body.address;
    if (typeof body.city === "string") updates.city = body.city;
    if (typeof body.country_code === "string" && body.country_code.length === 2) updates.country_code = body.country_code;
    if (typeof body.timezone === "string") updates.timezone = body.timezone;
    if (typeof body.is_default === "boolean") updates.is_default = body.is_default;

    const { data, error } = await supabase
      .from("branches")
      .update(updates)
      .eq("id", branchId)
      .eq("business_id", businessId)
      .select("*")
      .maybeSingle();
    if (error) return badRequest("update_failed", error.message);
    return ok({ branch: data });
  }

  return new Response("method not allowed", { status: 405 });
}

async function handleCustomers(req: Request, userId: string, url: URL) {
  const method = req.method.toUpperCase();

  if (method === "GET") {
    const businessId = url.searchParams.get("business_id");
    if (!businessId) return badRequest("business_id required");
    await requireMembership(businessId, userId, ["owner", "admin", "staff"]);
    const { data, error } = await supabase
      .from("customers")
      .select("id,business_id,branch_id,touchpoint_id,first_name,last_name,email,phone,source,status,created_at,updated_at")
      .eq("business_id", businessId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return ok({ customers: data ?? [] });
  }

  if (method === "POST") {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return badRequest("invalid json");
    const businessId = body.business_id as string;
    if (!businessId) return badRequest("business_id required");
    await requireMembership(businessId, userId, ["owner", "admin", "staff"]);
    const branchId = typeof body.branch_id === "string" ? body.branch_id : null;
    const touchpointId = typeof body.touchpoint_id === "string" ? body.touchpoint_id : null;
    await ensureBranch(businessId, branchId);
    await ensureTouchpoint(businessId, touchpointId);
    const payload = {
      business_id: businessId,
      branch_id: branchId,
      touchpoint_id: touchpointId,
      first_name: typeof body.first_name === "string" ? body.first_name : null,
      last_name: typeof body.last_name === "string" ? body.last_name : null,
      email: typeof body.email === "string" ? body.email : null,
      phone: typeof body.phone === "string" ? body.phone : null,
      source: (typeof body.source === "string" && ["profile", "qr", "nfc", "manual", "import", "unknown"].includes(body.source))
        ? body.source
        : "unknown",
      status: (typeof body.status === "string" && ["lead", "active", "inactive"].includes(body.status)) ? body.status : "lead",
      notes: typeof body.notes === "string" ? body.notes : null,
    };
    const { data, error } = await supabase.from("customers").insert(payload).select("*").maybeSingle();
    if (error) return badRequest("insert_failed", error.message);
    await supabase.from("customer_events").insert({
      business_id: businessId,
      customer_id: data?.id,
      touchpoint_id: touchpointId,
      event_type: "created",
      summary: "Customer created",
      metadata: null,
    });
    return ok({ customer: data }, 201);
  }

  if (method === "PATCH") {
    const pathParts = url.pathname.split("/").filter(Boolean);
    const customerId = pathParts[pathParts.length - 1];
    if (!customerId) return badRequest("customer id required");
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return badRequest("invalid json");
    const businessId = body.business_id as string;
    if (!businessId) return badRequest("business_id required");
    await requireMembership(businessId, userId, ["owner", "admin", "staff"]);
    const updates: Record<string, unknown> = {};
    if (typeof body.first_name === "string") updates.first_name = body.first_name;
    if (typeof body.last_name === "string") updates.last_name = body.last_name;
    if (typeof body.email === "string") updates.email = body.email;
    if (typeof body.phone === "string") updates.phone = body.phone;
    if (typeof body.notes === "string") updates.notes = body.notes;
    if (typeof body.status === "string" && ["lead", "active", "inactive"].includes(body.status)) updates.status = body.status;
    if (typeof body.source === "string" && ["profile", "qr", "nfc", "manual", "import", "unknown"].includes(body.source)) updates.source = body.source;
    const branchId = typeof body.branch_id === "string" ? body.branch_id : null;
    const touchpointId = typeof body.touchpoint_id === "string" ? body.touchpoint_id : null;
    await ensureBranch(businessId, branchId);
    await ensureTouchpoint(businessId, touchpointId);
    updates.branch_id = branchId;
    updates.touchpoint_id = touchpointId;

    const { data, error } = await supabase
      .from("customers")
      .update(updates)
      .eq("id", customerId)
      .eq("business_id", businessId)
      .select("*")
      .maybeSingle();
    if (error) return badRequest("update_failed", error.message);
    return ok({ customer: data });
  }

  return new Response("method not allowed", { status: 405 });
}

async function handleCustomerEvents(req: Request, userId: string) {
  if (req.method.toUpperCase() !== "POST") return new Response("method not allowed", { status: 405 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return badRequest("invalid json");
  const businessId = body.business_id as string;
  const customerId = body.customer_id as string;
  if (!businessId || !customerId) return badRequest("business_id and customer_id required");
  await requireMembership(businessId, userId, ["owner", "admin", "staff"]);
  const touchpointId = typeof body.touchpoint_id === "string" ? body.touchpoint_id : null;
  await ensureTouchpoint(businessId, touchpointId);
  const eventType = body.event_type as string;
  if (!eventType || !["created", "note", "interaction", "status_change"].includes(eventType)) {
    return badRequest("invalid event_type");
  }
  const summary = typeof body.summary === "string" && body.summary.length > 0 ? body.summary : null;
  if (!summary) return badRequest("summary required");
  const metadata = typeof body.metadata === "object" && body.metadata !== null ? body.metadata : null;
  const { error } = await supabase.from("customer_events").insert({
    business_id: businessId,
    customer_id: customerId,
    touchpoint_id: touchpointId,
    event_type: eventType,
    summary,
    metadata,
  });
  if (error) return badRequest("insert_failed", error.message);
  return ok({ status: "created" }, 201);
}

async function handleReputation(req: Request, userId: string, url: URL) {
  const method = req.method.toUpperCase();
  const pathParts = url.pathname.split("/").filter(Boolean);
  const businessId = pathParts[pathParts.length - 1];
  if (!businessId) return badRequest("business_id required");
  await requireMembership(businessId, userId, ["owner", "admin"]);

  if (method === "GET") {
    const { data, error } = await supabase
      .from("reputation_settings")
      .select("business_id,primary_platform,review_url,feedback_instructions,updated_at")
      .eq("business_id", businessId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return ok({ reputation: data });
  }

  if (method === "PUT" || method === "PATCH") {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body) return badRequest("invalid json");
    const payload = {
      business_id: businessId,
      primary_platform: typeof body.primary_platform === "string" ? body.primary_platform : null,
      review_url: typeof body.review_url === "string" ? body.review_url : null,
      feedback_instructions: typeof body.feedback_instructions === "string" ? body.feedback_instructions : null,
    };
    const { data, error } = await supabase
      .from("reputation_settings")
      .upsert(payload, { onConflict: "business_id" })
      .select("*")
      .maybeSingle();
    if (error) return badRequest("upsert_failed", error.message);
    return ok({ reputation: data });
  }

  return new Response("method not allowed", { status: 405 });
}

async function handleTouchpointBranch(req: Request, userId: string, url: URL) {
  if (req.method.toUpperCase() !== "PATCH") return new Response("method not allowed", { status: 405 });
  const pathParts = url.pathname.split("/").filter(Boolean);
  const touchpointId = pathParts[pathParts.length - 2];
  if (!touchpointId) return badRequest("touchpoint id required");
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return badRequest("invalid json");
  const businessId = body.business_id as string;
  if (!businessId) return badRequest("business_id required");
  await requireMembership(businessId, userId, ["owner", "admin"]);
  const branchId = typeof body.branch_id === "string" ? body.branch_id : null;
  await ensureBranch(businessId, branchId);
  await ensureTouchpoint(businessId, touchpointId);
  const { data, error } = await supabase
    .from("touchpoints")
    .update({ branch_id: branchId })
    .eq("id", touchpointId)
    .eq("business_id", businessId)
    .select("id,business_id,branch_id")
    .maybeSingle();
  if (error) return badRequest("update_failed", error.message);
  return ok({ touchpoint: data });
}

serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const pathname = url.pathname;

    const userId = await getUserIdFromAuth(supabase, req);

    if (pathname.startsWith("/branches")) {
      return await handleBranches(req, userId, url);
    }

    if (pathname.startsWith("/customers") && pathname.includes("/events")) {
      return await handleCustomerEvents(req, userId);
    }

    if (pathname.startsWith("/customers")) {
      return await handleCustomers(req, userId, url);
    }

    if (pathname.startsWith("/reputation/")) {
      return await handleReputation(req, userId, url);
    }

    if (pathname.startsWith("/touchpoints/") && pathname.endsWith("/branch")) {
      return await handleTouchpointBranch(req, userId, url);
    }

    return new Response("not found", { status: 404 });
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("dashboard-api error", err);
    return new Response("server_error", { status: 500 });
  }
});
