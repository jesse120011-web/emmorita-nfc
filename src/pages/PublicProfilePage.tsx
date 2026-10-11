import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { PublicLinkButton } from "../components/PublicLinkButton";
import { SiteHeader } from "../components/SiteHeader";
import { sourceFromSearch, trackEvent } from "../lib/analytics";
import { getPublicEnv } from "../lib/env";
import { getSupabaseBrowserClient } from "../lib/supabase";
import { isSafeHref } from "../lib/urls";
import type { PublicLink, PublicProfile, PublicTouchpointResolution } from "../lib/types";

export function PublicProfilePage() {
  const { slug = "" } = useParams();
  const location = useLocation();
  const source = useMemo(() => sourceFromSearch(location.search), [location.search]);
  const touchpointToken = useMemo(() => new URLSearchParams(location.search).get("tp"), [location.search]);
  const [status, setStatus] = useState<"loading" | "missing" | "ready" | "unconfigured">("loading");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [links, setLinks] = useState<PublicLink[]>([]);
  const [touchpointContext, setTouchpointContext] = useState<
    | Pick<PublicTouchpointResolution, "touchpoint_id" | "qr_code_id" | "nfc_tag_id" | "channel">
    | null
  >(null);

  useEffect(() => {
    const env = getPublicEnv();
    const supabase = getSupabaseBrowserClient();
    if (!env.configured || !supabase) {
      setStatus("unconfigured");
      return;
    }
    const client = supabase;

    let cancelled = false;

    async function load() {
      const profileResult = await client
        .from("public_profiles")
        .select("id, slug, name, country_code, logo_url, tagline, description, location_label")
        .eq("slug", slug)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (profileResult.error || !profileResult.data) {
        setStatus("missing");
        return;
      }

      const row = profileResult.data as PublicProfile;
      setProfile(row);

      let resolvedContext:
        | Pick<PublicTouchpointResolution, "touchpoint_id" | "qr_code_id" | "nfc_tag_id" | "channel" | "business_id">
        | null = null;

      setTouchpointContext(null);

      if (touchpointToken) {
        const touchpointResult = await client
          .from("public_touchpoint_resolutions")
          .select("business_id, touchpoint_id, channel, qr_code_id, nfc_tag_id")
          .eq("public_token", touchpointToken)
          .maybeSingle();

        if (!touchpointResult.error && touchpointResult.data) {
          const resolution = touchpointResult.data as Pick<
            PublicTouchpointResolution,
            "business_id" | "touchpoint_id" | "qr_code_id" | "nfc_tag_id" | "channel"
          >;
          if (resolution.business_id === row.id) {
            resolvedContext = resolution;
            setTouchpointContext(resolution);
          }
        }
      }

      const linksResult = await client
        .from("public_links")
        .select("id, business_id, kind, label, href, sort_order")
        .eq("business_id", row.id)
        .order("sort_order", { ascending: true });

      if (!cancelled) {
        setLinks((linksResult.data as PublicLink[] | null) ?? []);
        setStatus("ready");
      }

      await trackEvent({
        eventType: "PROFILE_VIEW",
        source,
        slug,
        publicToken: touchpointToken ?? undefined,
        touchpointId: resolvedContext?.touchpoint_id ?? undefined,
      });

      if (resolvedContext?.channel === "nfc") {
        await trackEvent({
          eventType: "NFC_TAP",
          source: "nfc",
          slug,
          publicToken: touchpointToken ?? undefined,
          touchpointId: resolvedContext.touchpoint_id ?? undefined,
        });
      }

      if (resolvedContext?.channel === "qr") {
        await trackEvent({
          eventType: "QR_SCAN",
          source: "qr",
          slug,
          publicToken: touchpointToken ?? undefined,
          touchpointId: resolvedContext.touchpoint_id ?? undefined,
        });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, source, touchpointToken]);

  const safeLinks = links.filter((link) => isSafeHref(link.href));
  const arrival =
    touchpointContext?.channel === "nfc"
      ? "Arrived via NFC tap"
      : touchpointContext?.channel === "qr"
        ? "Arrived via QR scan"
        : null;

  return (
    <>
      <SiteHeader />
      <main className="page stack">
        {status === "loading" ? (
          <section className="card skeleton-card" role="status">
            <div className="loading-block" />
            <div className="loading-block" />
          </section>
        ) : null}

        {status === "unconfigured" ? (
          <section className="card stack" role="alert">
            <h1>Profile unavailable</h1>
            <p>This environment is missing Supabase public credentials.</p>
          </section>
        ) : null}

        {status === "missing" ? (
          <section className="card stack" role="alert">
            <h1>Business not found</h1>
            <p>This profile is unpublished, suspended, or the link is incorrect.</p>
          </section>
        ) : null}

        {status === "ready" && profile ? (
          <article className="profile-card" aria-label="Public profile">
            <div className="profile-header">
              {profile.logo_url ? (
                <img className="logo" src={profile.logo_url} alt={`${profile.name} logo`} />
              ) : (
                <div className="logo" aria-hidden="true" />
              )}
              <div className="stack">
                <p className="eyebrow">EmmOrita business profile</p>
                <h1>{profile.name}</h1>
                {profile.tagline ? <p className="muted">{profile.tagline}</p> : null}
                {arrival ? <span className="pill active">{arrival}</span> : null}
              </div>
            </div>

            <div className="profile-meta">
              {profile.location_label ? <span><strong>Location:</strong> {profile.location_label}</span> : null}
              {profile.description ? <span>{profile.description}</span> : null}
            </div>

            <div className="profile-actions cta-list" aria-label="Available actions">
              {safeLinks.map((link) => (
                <PublicLinkButton
                  key={link.id}
                  linkId={link.id}
                  kind={link.kind}
                  href={link.href}
                  label={link.label}
                  source={source}
                  touchpointId={touchpointContext?.touchpoint_id ?? undefined}
                />
              ))}
            </div>
            {safeLinks.length === 0 ? (
              <p className="muted">This business has not added safe public actions yet.</p>
            ) : null}
          </article>
        ) : null}
      </main>
    </>
  );
}
