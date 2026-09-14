import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { getPublicEnv } from "../lib/env";
import { getSupabaseBrowserClient } from "../lib/supabase";
import type { PublicTouchpointResolution } from "../lib/types";

export function ScanRedirectPage() {
  const { publicToken = "" } = useParams();
  const [target, setTarget] = useState<{ slug: string; source: "qr" | "nfc" } | null>(null);
  const [status, setStatus] = useState<"loading" | "missing" | "unconfigured">("loading");

  useEffect(() => {
    const env = getPublicEnv();
    const supabase = getSupabaseBrowserClient();
    if (!env.configured || !supabase) {
      setStatus("unconfigured");
      return;
    }

    let cancelled = false;
    async function load() {
      const { data, error } = await supabase
        .from("public_touchpoint_resolutions")
        .select("slug, channel, public_token")
        .eq("public_token", publicToken)
        .maybeSingle();

      if (cancelled) {
        return;
      }
      if (error || !data) {
        setStatus("missing");
        return;
      }

      const row = data as Pick<PublicTouchpointResolution, "slug" | "channel">;
      setTarget({ slug: row.slug, source: row.channel });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [publicToken]);

  if (target) {
    const params = new URLSearchParams({
      src: target.source,
      tp: publicToken,
    });
    return <Navigate to={`/t/${target.slug}?${params.toString()}`} replace />;
  }

  return (
    <>
      <SiteHeader />
      <main className="page">
        {status === "loading" ? <p>Resolving touchpoint…</p> : null}
        {status === "unconfigured" ? (
          <section className="card">
            <h1>Scan unavailable</h1>
            <p>This environment is missing Supabase public credentials.</p>
          </section>
        ) : null}
        {status === "missing" ? (
          <section className="card">
            <h1>Scan not found</h1>
            <p>This touchpoint is invalid, inactive, or unpublished.</p>
          </section>
        ) : null}
      </main>
    </>
  );
}
