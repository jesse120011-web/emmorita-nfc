import type { DeviceClass } from "./types";

export function classifyDevice(userAgent: string): DeviceClass {
  const ua = userAgent.toLowerCase();
  if (!ua) {
    return "unknown";
  }
  if (/ipad|tablet/.test(ua)) {
    return "tablet";
  }
  if (/mobi|iphone|android/.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

export function truncate(value: string, max = 240): string {
  return value.length <= max ? value : value.slice(0, max);
}
