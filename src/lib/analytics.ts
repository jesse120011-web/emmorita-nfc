import { classifyDevice, truncate } from "./device";
import { getSupabaseBrowserClient } from "./supabase";
import type { AnalyticsEventType, LinkKind, ProfileSource } from "./types";

type TrackInput = {
  businessId: string;
  eventType: AnalyticsEventType;
  source: ProfileSource;
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
      return "website_click";
    case "whatsapp":
      return "whatsapp_click";
    case "phone":
      return "phone_click";
    case "maps":
      return "map_click";
    case "booking":
      return "booking_click";
    case "email":
      return "email_click";
    default:
      return "social_click";
  }
}

export async function trackEvent(input: TrackInput): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) {
    return;
  }

  const userAgent = truncate(navigator.userAgent);
  const referrer = truncate(document.referrer);

  const { error } = await supabase.from("analytics_events").insert({
    business_id: input.businessId,
    event_type: input.eventType,
    source: input.source,
    link_id: input.linkId ?? null,
    device_class: classifyDevice(userAgent),
    user_agent: userAgent || null,
    referrer: referrer || null,
  });

  if (error && import.meta.env.DEV) {
    console.warn("analytics insert skipped", error.message);
  }
}
