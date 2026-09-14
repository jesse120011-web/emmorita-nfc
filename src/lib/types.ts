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
