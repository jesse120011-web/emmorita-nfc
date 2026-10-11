import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ALLOWED_EVENTS = new Set([
  "PROFILE_VIEW",
  "NFC_TAP",
  "QR_SCAN",
  "WEBSITE_CLICK",
  "WHATSAPP_CLICK",
  "CALL_CLICK",
  "DIRECTIONS_CLICK",
  "REVIEW_CLICK",
]);

const MAX_PAYLOAD_BYTES = 4096;
const WINDOW_SECONDS = 300;
const MAX_EVENTS_PER_WINDOW = 120;

type Channel = "qr" | "nfc" | "web" | "unknown";

type ResolvedContext = {
  business_id: string;
  touchpoint_id: string | null;
  qr_code_id: string | null;
  nfc_tag_id: string | null;
  link_id: string | null;
  branch_id: string | null;
  channel: Channel;
};

function classifyDevice(userAgent: string): "mobile" | "tablet" | "desktop" | "unknown" {
  const ua = userAgent.toLowerCase();
  if (!ua) return "unknown";
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobi|iphone|android/.test(ua)) return "mobile";
  return "desktop";
}

function truncate(value: string, max = 240): string {
  return value.length <= max ? value : value.slice(0, max);
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function ensureBusinessIsPublic(businessId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("business_is_public", { _business_id: businessId });
  if (error) throw new Error(`business_is_public failed: ${error.message}`);
  return Boolean(data);
}

async function ensureBranchBelongs(businessId: string, branchId: string): Promise<void> {
  const { data, error } = await supabase
    .from("branches")
    .select("business_id")
    .eq("id", branchId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`branch lookup failed: ${error.message}`);
  if (!data) throw new Error("branch_not_found");
  if (data.business_id !== businessId) throw new Error("branch_mismatch");
}

async function resolveContext(input: {
  public_token?: string;
  touchpoint_id?: string;
  link_id?: string;
  slug?: string;
  source: Channel;
  event_type: string;
}): Promise<ResolvedContext> {
  if (input.public_token) {
    const { data, error } = await supabase
      .from("public_touchpoint_resolutions")
      .select("business_id,touchpoint_id,qr_code_id,nfc_tag_id,channel")
      .eq("public_token", input.public_token)
      .maybeSingle();
    if (error) throw new Error(`touchpoint resolution failed: ${error.message}`);
    if (!data) throw new Error("touchpoint_not_found");
    return {
      business_id: data.business_id,
      touchpoint_id: data.touchpoint_id,
      qr_code_id: data.qr_code_id,
      nfc_tag_id: data.nfc_tag_id,
      link_id: null,
      branch_id: null,
      channel: (data.channel as Channel) ?? "unknown",
    };
  }

  if (input.touchpoint_id) {
    const { data, error } = await supabase
      .from("touchpoints")
      .select("id,business_id,qr_code_id,nfc_tag_id,channel,branch_id")
      .eq("id", input.touchpoint_id)
      .maybeSingle();
    if (error) throw new Error(`touchpoint lookup failed: ${error.message}`);
    if (!data) throw new Error("touchpoint_not_found");
    return {
      business_id: data.business_id,
      touchpoint_id: data.id,
      qr_code_id: data.qr_code_id,
      nfc_tag_id: data.nfc_tag_id,
      link_id: null,
      branch_id: data.branch_id,
      channel: (data.channel as Channel) ?? input.source ?? "unknown",
    };
  }

  if (input.link_id) {
    const { data, error } = await supabase
      .from("business_links")
      .select("id,business_id")
      .eq("id", input.link_id)
      .maybeSingle();
    if (error) throw new Error(`link lookup failed: ${error.message}`);
    if (!data) throw new Error("link_not_found");
    return {
      business_id: data.business_id,
      touchpoint_id: null,
      qr_code_id: null,
      nfc_tag_id: null,
      link_id: data.id,
      branch_id: null,
      channel: input.source ?? "unknown",
    };
  }

  if (input.event_type === "PROFILE_VIEW" && input.slug) {
    const normalizedSlug = input.slug.trim().toLowerCase();
    if (!normalizedSlug) throw new Error("context_missing");
    const { data, error } = await supabase
      .from("public_profiles")
      .select("id")
      .eq("slug", normalizedSlug)
      .maybeSingle();
    if (error) throw new Error(`profile lookup failed: ${error.message}`);
    if (!data) throw new Error("profile_not_found");
    return {
      business_id: data.id,
      touchpoint_id: null,
      qr_code_id: null,
      nfc_tag_id: null,
      link_id: null,
      branch_id: null,
      channel: "web",
    };
  }

  throw new Error("context_missing");
}

serve(async (req) => {
  try {
    const contentLength = req.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_PAYLOAD_BYTES) {
      return new Response("payload too large", { status: 413 });
    }

    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > MAX_PAYLOAD_BYTES) {
      return new Response("payload too large", { status: 413 });
    }

    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw || "{}");
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return new Response("invalid json", { status: 400 });
      }
      body = parsed as Record<string, unknown>;
    } catch {
      return new Response("invalid json", { status: 400 });
    }

    const event_type = body.event_type as string;
    if (!ALLOWED_EVENTS.has(event_type)) {
      return new Response("invalid event_type", { status: 400 });
    }

    const sourceHeader = body.source as string;
    const source: Channel = sourceHeader === "qr" || sourceHeader === "nfc" ? sourceHeader : "web";

    const context = await resolveContext({
      public_token: typeof body.public_token === "string" ? body.public_token : undefined,
      touchpoint_id: typeof body.touchpoint_id === "string" ? body.touchpoint_id : undefined,
      link_id: typeof body.link_id === "string" ? body.link_id : undefined,
      slug: typeof body.slug === "string" ? body.slug : undefined,
      source,
      event_type,
    });

    const explicitBranch = typeof body.branch_id === "string" ? body.branch_id : null;
    const branch_id = explicitBranch ?? context.branch_id;
    if (branch_id) {
      await ensureBranchBelongs(context.business_id, branch_id);
      if (context.branch_id && context.branch_id !== branch_id) {
        return new Response("branch_touchpoint_mismatch", { status: 400 });
      }
    }

    const isPublic = await ensureBusinessIsPublic(context.business_id);
    if (!isPublic) {
      return new Response("business not public", { status: 403 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const ipHash = await sha256Hex(ip);
    const { data: rateCount, error: rateError } = await supabase.rpc("increment_analytics_rate_limit", {
      _ip_hash: ipHash,
      _business_id: context.business_id,
      _window_seconds: WINDOW_SECONDS,
      _max_events: MAX_EVENTS_PER_WINDOW,
    });
    if (rateError) {
      const msg = rateError.message || "rate limit error";
      if (msg.toLowerCase().includes("rate limit exceeded")) {
        return new Response("rate limit", { status: 429 });
      }
      console.error("rate limit error", msg);
      return new Response("rate limit error", { status: 500 });
    }
    if (typeof rateCount === "number" && rateCount > MAX_EVENTS_PER_WINDOW) {
      return new Response("rate limit", { status: 429 });
    }

    const user_agent = truncate(req.headers.get("user-agent") ?? "");
    const referrer = truncate(req.headers.get("referer") ?? "");

    const device_class = classifyDevice(user_agent);

    const insertPayload = {
      business_id: context.business_id,
      event_type,
      source,
      touchpoint_id: context.touchpoint_id,
      qr_code_id: context.qr_code_id,
      nfc_tag_id: context.nfc_tag_id,
      link_id: context.link_id,
      branch_id,
      device_class,
      user_agent: user_agent || null,
      referrer: referrer || null,
    };

    const { error: insertError } = await supabase.from("analytics_events").insert(insertPayload);
    if (insertError) {
      console.error("insert error", insertError.message);
      return new Response("insert failed", { status: 500 });
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status =
      message === "touchpoint_not_found" ||
      message === "profile_not_found" ||
      message === "context_missing" ||
      message === "link_not_found" ||
      message === "branch_not_found"
        ? 404
        : message === "branch_mismatch" || message === "branch_touchpoint_mismatch"
          ? 400
          : message.toLowerCase().includes("rate limit exceeded")
            ? 429
            : 500;
    console.error("track-analytics error", message);
    return new Response(message, { status });
  }
});
