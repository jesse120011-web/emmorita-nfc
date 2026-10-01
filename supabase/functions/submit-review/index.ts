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

const MAX_PAYLOAD_BYTES = 24576;
const MAX_REVIEW_TEXT_CHARS = 4000;
const MAX_REVIEWER_NAME_CHARS = 120;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const WINDOW_SECONDS = 600;
const MAX_REVIEWS_PER_WINDOW = 3;

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function characterLength(value: string): number {
  return [...value].length;
}

function asOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error("invalid_field");
  }
  return value;
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function businessIsPublic(businessId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("business_is_public", { _business_id: businessId });
  if (error) {
    throw new Error(`business_is_public failed: ${error.message}`);
  }
  return Boolean(data);
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return jsonResponse(405, { error: "method_not_allowed" });
    }

    const contentLength = req.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_PAYLOAD_BYTES) {
      return jsonResponse(413, { error: "payload_too_large" });
    }

    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > MAX_PAYLOAD_BYTES) {
      return jsonResponse(413, { error: "payload_too_large" });
    }

    let body: Record<string, unknown>;
    try {
      const parsed = JSON.parse(raw || "{}");
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        return jsonResponse(400, { error: "invalid_json" });
      }
      body = parsed as Record<string, unknown>;
    } catch (_err) {
      return jsonResponse(400, { error: "invalid_json" });
    }

    const allowedKeys = new Set(["slug", "rating", "review_text", "reviewer_name", "public_token"]);
    for (const key of Object.keys(body)) {
      if (!allowedKeys.has(key)) {
        return jsonResponse(400, { error: "unexpected_field" });
      }
    }

    const slugRaw = asOptionalString(body.slug);
    const slug = slugRaw?.trim().toLowerCase() ?? "";
    if (!slug || slug.length < 2 || slug.length > 64 || !SLUG_PATTERN.test(slug)) {
      return jsonResponse(400, { error: "invalid_slug" });
    }

    const ratingValue = body.rating;
    if (typeof ratingValue !== "number" || !Number.isInteger(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      return jsonResponse(400, { error: "invalid_rating" });
    }

    const reviewTextRaw = asOptionalString(body.review_text);
    const reviewText = reviewTextRaw?.trim() ? reviewTextRaw.trim() : null;
    if (reviewText && characterLength(reviewText) > MAX_REVIEW_TEXT_CHARS) {
      return jsonResponse(400, { error: "invalid_review_text" });
    }

    const reviewerNameRaw = asOptionalString(body.reviewer_name);
    const reviewerName = reviewerNameRaw?.trim() ? reviewerNameRaw.trim() : null;
    if (reviewerName && characterLength(reviewerName) > MAX_REVIEWER_NAME_CHARS) {
      return jsonResponse(400, { error: "invalid_reviewer_name" });
    }

    const publicTokenRaw = asOptionalString(body.public_token);
    const publicToken = publicTokenRaw?.trim() ? publicTokenRaw.trim() : undefined;

    const { data: profile, error: profileError } = await supabase
      .from("public_profiles")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (profileError) {
      throw new Error(`profile lookup failed: ${profileError.message}`);
    }
    if (!profile?.id) {
      return jsonResponse(404, { error: "profile_not_found" });
    }

    const businessId = profile.id as string;
    const isPublic = await businessIsPublic(businessId);
    if (!isPublic) {
      return jsonResponse(403, { error: "business_not_public" });
    }

    if (publicToken) {
      const { data: touchpoint, error: touchpointError } = await supabase
        .from("public_touchpoint_resolutions")
        .select("business_id")
        .eq("public_token", publicToken)
        .maybeSingle();
      if (touchpointError) {
        throw new Error(`touchpoint resolution failed: ${touchpointError.message}`);
      }
      if (!touchpoint || touchpoint.business_id !== businessId) {
        return jsonResponse(400, { error: "invalid_public_token" });
      }
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";
    const ipHash = await sha256Hex(ip);
    const { error: rateError } = await supabase.rpc("increment_review_rate_limit", {
      _ip_hash: ipHash,
      _business_id: businessId,
      _window_seconds: WINDOW_SECONDS,
      _max_reviews: MAX_REVIEWS_PER_WINDOW,
    });
    if (rateError) {
      const message = rateError.message || "rate limit error";
      if (message.toLowerCase().includes("rate limit exceeded")) {
        return jsonResponse(429, { error: "rate_limit" });
      }
      console.error("review rate limit error", message);
      return jsonResponse(500, { error: "rate_limit_error" });
    }

    const { error: insertError } = await supabase.from("reviews").insert({
      business_id: businessId,
      rating: ratingValue,
      review_text: reviewText,
      reviewer_name: reviewerName,
      status: "pending",
    });
    if (insertError) {
      console.error("review insert error", insertError.message);
      return jsonResponse(500, { error: "insert_failed" });
    }

    return jsonResponse(201, { ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "invalid_field") {
      return jsonResponse(400, { error: "invalid_field" });
    }
    console.error("submit-review error", message);
    return jsonResponse(500, { error: "internal_error" });
  }
});
