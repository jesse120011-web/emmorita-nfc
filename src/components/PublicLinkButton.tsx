import type { AnalyticsEventType, LinkKind, ProfileSource } from "../lib/types";
import { eventTypeForLinkKind, trackEvent } from "../lib/analytics";

type Props = {
  businessId: string;
  linkId: string;
  kind: LinkKind;
  href: string;
  label: string;
  source: ProfileSource;
};

export function PublicLinkButton({ businessId, linkId, kind, href, label, source }: Props) {
  async function onClick() {
    const eventType: AnalyticsEventType = eventTypeForLinkKind(kind);
    await trackEvent({
      businessId,
      eventType,
      source,
      linkId,
    });
  }

  return (
    <a className="cta" href={href} onClick={() => void onClick()}>
      {label}
    </a>
  );
}
