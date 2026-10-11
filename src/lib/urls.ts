export function isSafeHref(href: string): boolean {
  if (!href || typeof href !== "string") return false;
  const value = href.trim();
  const lower = value.toLowerCase();

  const allowedPrefixes = ["https://", "http://", "mailto:", "tel:", "sms:", "whatsapp://"];
  if (allowedPrefixes.some((prefix) => lower.startsWith(prefix))) {
    return true;
  }

  if (lower.startsWith("https://wa.me/")) return true;
  if (lower.startsWith("https://api.whatsapp.com/")) return true;

  return false;
}
