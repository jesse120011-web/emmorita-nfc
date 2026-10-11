import type { AnalyticsEventType, LinkKind, ProfileSource } from "../lib/types";
import { eventTypeForLinkKind, trackEvent } from "../lib/analytics";
import { isSafeHref } from "../lib/urls";

type Props = {
  linkId: string;
  kind: LinkKind;
  href: string;
  label: string;
  source: ProfileSource;
  touchpointId?: string;
};

export function PublicLinkButton({ linkId, kind, href, label, source, touchpointId }: Props) {
  if (!isSafeHref(href)) {
    return null;
  }

  const openInNewTab = href.startsWith("http");
  const rel = openInNewTab ? "noopener noreferrer" : undefined;

  async function onClick() {
    const eventType: AnalyticsEventType = eventTypeForLinkKind(kind);
    await trackEvent({
      eventType,
      source,
      linkId,
      touchpointId,
    });
  }

  return (
    <a
      className="cta"
      href={href}
      target={openInNewTab ? "_blank" : undefined}
      rel={rel}
      aria-label={label}
      onClick={() => void onClick()}
    >
      {label}
    </a>
  );
}
