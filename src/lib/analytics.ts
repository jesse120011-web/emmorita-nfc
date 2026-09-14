import { classifyDevice, truncate } from "./device";
import { getSupabaseBrowserClient } from "./supabase";
import type { AnalyticsEventType, LinkKind, ProfileSource } from "./types";

type TrackInput = {
  businessId: string;
  eventType: AnalyticsEventType;
  source: ProfileSource;
  touchpointId?: string;
  qrCodeId?: string;
  nfcTagId?: string;
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
    touchpoint_id: input.touchpointId ?? null,
    qr_code_id: input.qrCodeId ?? null,
    nfc_tag_id: input.nfcTagId ?? null,
    link_id: input.linkId ?? null,
    device_class: classifyDevice(userAgent),
    user_agent: userAgent || null,
    referrer: referrer || null,
  });

  if (error && import.meta.env.DEV) {
    console.warn("analytics insert skipped", error.message);
  }
}
