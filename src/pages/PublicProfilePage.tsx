import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { PublicLinkButton } from "../components/PublicLinkButton";
import { SiteHeader } from "../components/SiteHeader";
import { sourceFromSearch, trackEvent } from "../lib/analytics";
import { getPublicEnv } from "../lib/env";
import { getSupabaseBrowserClient } from "../lib/supabase";
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

      // keep a local resolvedContext to pass to analytics immediately
      let resolvedContext: Pick<
        PublicTouchpointResolution,
        "touchpoint_id" | "qr_code_id" | "nfc_tag_id" | "channel" | "business_id"
      > | null = null;

      // clear previous context each load
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
        businessId: row.id,
        eventType: "PROFILE_VIEW",
        source,
        touchpointId: resolvedContext?.touchpoint_id,
        qrCodeId: resolvedContext?.qr_code_id ?? undefined,
        nfcTagId: resolvedContext?.nfc_tag_id ?? undefined,
      });

      if (resolvedContext?.channel === "nfc") {
        await trackEvent({
          businessId: row.id,
          eventType: "NFC_TAP",
          source: "nfc",
          touchpointId: resolvedContext.touchpoint_id,
          qrCodeId: resolvedContext.qr_code_id ?? undefined,
          nfcTagId: resolvedContext.nfc_tag_id ?? undefined,
        });
      }
      
      if (resolvedContext?.channel === "qr") {
        await trackEvent({
          businessId: row.id,
          eventType: "QR_SCAN",
          source: "qr",
          touchpointId: resolvedContext.touchpoint_id,
          qrCodeId: resolvedContext.qr_code_id ?? undefined,
          nfcTagId: resolvedContext.nfc_tag_id ?? undefined,
        });
      } 
    } 
    
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, source, touchpointToken]);

  return (
    <>
      <SiteHeader />
      <main className="page">
        {status === "loading" ? <p>Loading profile…</p> : null}
        {status === "unconfigured" ? (
          <section className="card">
            <h1>Profile unavailable</h1>
            <p>This environment is missing Supabase public credentials.</p>
          </section>
        ) : null}
        {status === "missing" ? (
          <section className="card">
            <h1>Business not found</h1>
            <p>This profile is unpublished, suspended, or the link is incorrect.</p>
          </section>
        ) : null}
        {status === "ready" && profile ? (
          <article className="profile-card">
            {profile.logo_url ? (
              <img className="logo" src={profile.logo_url} alt={`${profile.name} logo`} />
            ) : null}
            <h1>{profile.name}</h1>
            {profile.tagline ? <p>{profile.tagline}</p> : null}
            {profile.location_label ? <p className="muted">{profile.location_label}</p> : null}
            {profile.description ? <p>{profile.description}</p> : null}
            <div className="cta-list">
              {links.map((link) => (
                <PublicLinkButton
                  key={link.id}
                  businessId={profile.id}
                  linkId={link.id}
                  kind={link.kind}
                  href={link.href}
                  label={link.label}
                  source={source}
                  touchpointId={touchpointContext?.touchpoint_id}
                />
              ))}
            </div>
            {links.length === 0 ? (
              <p className="muted">This business has not added public actions yet.</p>
            ) : null}
          </article>
        ) : null}
      </main>
    </>
  );
}
