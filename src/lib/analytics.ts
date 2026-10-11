import { getPublicEnv } from "./env";
import type { AnalyticsEventType, LinkKind, ProfileSource } from "./types";

type TrackPayload = {
  eventType: AnalyticsEventType;
  source: ProfileSource;
  slug?: string;
  publicToken?: string;
  touchpointId?: string;
  linkId?: string;
};

export function sourceFromSearch(search: string): ProfileSource {
  const params = new URLSearchParams(search);
  const src = params.get("src");
  if (src === "nfc" || src === "qr") {
    return src;
  }
  return "web";
}

export function eventTypeForLinkKind(kind: LinkKind): AnalyticsEventType {
  switch (kind) {
    case "website":
      return "WEBSITE_CLICK";
    case "whatsapp":
      return "WHATSAPP_CLICK";
    case "phone":
      return "CALL_CLICK";
    case "maps":
      return "DIRECTIONS_CLICK";
    default:
      return "WEBSITE_CLICK";
  }
}

export async function trackEvent(input: TrackPayload): Promise<void> {
  const env = getPublicEnv();
  if (!env.configured) return;

  const payload: Record<string, unknown> = {
    event_type: input.eventType,
    source: input.source,
  };

  if (input.slug) {
    payload.slug = input.slug;
  }
  if (input.publicToken) {
    payload.public_token = input.publicToken;
  }
  if (input.touchpointId) {
    payload.touchpoint_id = input.touchpointId;
  }
  if (input.linkId) {
    payload.link_id = input.linkId;
  }

  const url = `${env.supabaseUrl.replace(/\/$/, "")}/functions/v1/track-analytics`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.supabaseAnonKey,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok && import.meta.env.DEV) {
      console.warn("analytics post failed", res.status);
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("analytics error", error);
    }
  }
}
