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

export type Branch = {
  id: string;
  business_id?: string;
  name: string;
  slug: string | null;
  address: string | null;
  city: string | null;
  country_code: string | null;
  timezone: string | null;
  is_default: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type Touchpoint = {
  id: string;
  business_id: string;
  label: string | null;
  channel: "qr" | "nfc";
  status: string;
  public_token: string | null;
  qr_code_id: string | null;
  nfc_tag_id: string | null;
  branch_id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CustomerStatus = "lead" | "active" | "inactive";
export type CustomerSource = "profile" | "qr" | "nfc" | "manual" | "import" | "unknown";

export type Customer = {
  id: string;
  business_id: string;
  branch_id: string | null;
  touchpoint_id: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  source: CustomerSource;
  status: CustomerStatus;
  notes: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CustomerEventType = "created" | "note" | "interaction" | "status_change";

export type CustomerEventInput = {
  business_id: string;
  customer_id: string;
  touchpoint_id?: string | null;
  event_type: CustomerEventType;
  summary: string;
  metadata?: Record<string, unknown> | null;
};

export type ReputationSettings = {
  business_id: string;
  primary_platform: string | null;
  review_url: string | null;
  feedback_instructions: string | null;
  updated_at?: string | null;
};

export type AnalyticsEventRecord = {
  id?: string;
  business_id?: string;
  event_type: string;
  source?: string | null;
  branch_id?: string | null;
  touchpoint_id?: string | null;
  link_id?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
};
