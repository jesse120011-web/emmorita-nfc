# Analytics

Events are rows in `analytics_events`. Types live in `analytics_event_types` so new names do not require a table redesign.

## Shipped types

| Key | When |
| --- | --- |
| `profile_view` | Public profile rendered |
| `nfc_scan` | Profile opened with `?src=nfc` |
| `qr_scan` | Profile opened with `?src=qr` |
| `website_click` | `kind = website` |
| `whatsapp_click` | `kind = whatsapp` |
| `phone_click` | `kind = phone` |
| `map_click` | `kind = maps` |
| `booking_click` | `kind = booking` |
| `email_click` | `kind = email` |
| `social_click` | Instagram, Facebook, TikTok, custom |

## Client writer

`src/lib/analytics.ts` inserts through the anon/authenticated client. RLS allows the insert only when `business_is_public(business_id)` is true.

Suggested NFC/QR payloads:

```
https://<domain>/t/<slug>?src=nfc
https://<domain>/t/<slug>?src=qr
```

Later, `nfc_tag_id` / `qr_code_id` can be added as query parameters once inventory tokens are encoded on the asset.

## What is stored

- `occurred_at` (server default if omitted)
- `source`: nfc | qr | web | unknown
- `device_class` derived from user agent
- `user_agent` truncated to 240 characters
- `referrer` truncated to 240 characters
- optional `link_id`, `nfc_tag_id`, `qr_code_id`
- `metadata` jsonb default `{}` (keep empty unless a specific non-PII field is required)

## What is not stored

IP address, precise geolocation, Auth user id of the visitor, and free-form form contents.

## Reading

The dashboard analytics page counts `event_type` for the active business. Production reporting should later use SQL aggregates or a daily rollup table; the event log is the source of truth.
