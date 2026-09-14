import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { PublicLinkButton } from "../components/PublicLinkButton";
import { SiteHeader } from "../components/SiteHeader";
import { sourceFromSearch, trackEvent } from "../lib/analytics";
import { getPublicEnv } from "../lib/env";
import { getSupabaseBrowserClient } from "../lib/supabase";
import type { PublicLink, PublicProfile } from "../lib/types";

export function PublicProfilePage() {
  const { slug = "" } = useParams();
  const location = useLocation();
  const source = useMemo(() => sourceFromSearch(location.search), [location.search]);
  const [status, setStatus] = useState<"loading" | "missing" | "ready" | "unconfigured">("loading");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [links, setLinks] = useState<PublicLink[]>([]);

  useEffect(() => {
    const env = getPublicEnv();
    const supabase = getSupabaseBrowserClient();
    if (!env.configured || !supabase) {
      setStatus("unconfigured");
      return;
    }

    let cancelled = false;

    async function load() {
      const profileResult = await supabase
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

      const linksResult = await supabase
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
        eventType: "profile_view",
        source,
      });

      if (source === "nfc") {
        await trackEvent({ businessId: row.id, eventType: "nfc_scan", source });
      }
      if (source === "qr") {
        await trackEvent({ businessId: row.id, eventType: "qr_scan", source });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, source]);

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
