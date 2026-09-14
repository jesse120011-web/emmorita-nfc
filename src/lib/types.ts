export type LinkKind =
  | "phone"
  | "whatsapp"
  | "website"
  | "maps"
  | "booking"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "email"
  | "custom";

export type AnalyticsEventType =
  | "QR_SCAN"
  | "NFC_TAP"
  | "PROFILE_VIEW"
  | "MENU_VIEW"
  | "WHATSAPP_CLICK"
  | "CALL_CLICK"
  | "WEBSITE_CLICK"
  | "DIRECTIONS_CLICK"
  | "REVIEW_CLICK"
  | "profile_view"
  | "nfc_scan"
  | "qr_scan"
  | "website_click"
  | "whatsapp_click"
  | "phone_click"
  | "map_click"
  | "booking_click"
  | "social_click"
  | "email_click";

export type ProfileSource = "nfc" | "qr" | "web" | "unknown";

export type DeviceClass = "mobile" | "tablet" | "desktop" | "unknown";

export type BusinessStatus = "draft" | "active" | "suspended";

export type BusinessMemberRole = "owner" | "admin" | "staff";

export type PublicProfile = {
  id: string;
  slug: string;
  name: string;
  country_code: string;
  logo_url: string | null;
  tagline: string | null;
  description: string | null;
  location_label: string | null;
};

export type PublicLink = {
  id: string;
  business_id: string;
  kind: LinkKind;
  label: string;
  href: string;
  sort_order: number;
};

export type PublicTouchpointResolution = {
  public_token: string;
  touchpoint_id: string;
  business_id: string;
  slug: string;
  channel: "qr" | "nfc";
  qr_code_id: string | null;
  nfc_tag_id: string | null;
};

export type MembershipRow = {
  id: string;
  business_id: string;
  role: BusinessMemberRole;
  businesses: {
    id: string;
    name: string;
    slug: string;
    status: BusinessStatus;
    country_code: string;
  } | null;
};
