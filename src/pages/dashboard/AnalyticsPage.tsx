import { useEffect, useState } from "react";
import { useTenant } from "../../dashboard/useTenant";
import { getSupabaseBrowserClient } from "../../lib/supabase";

type CountRow = { event_type: string };

export function AnalyticsPage() {
  const { active, loading } = useTenant();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !active) {
      return;
    }
    void supabase
      .from("analytics_events")
      .select("event_type")
      .eq("business_id", active.business_id)
      .then(({ data, error: queryError }) => {
        if (queryError) {
          setError(queryError.message);
          return;
        }
        const next: Record<string, number> = {};
        for (const row of (data as CountRow[] | null) ?? []) {
          next[row.event_type] = (next[row.event_type] ?? 0) + 1;
        }
        setCounts(next);
      });
  }, [active]);

  return (
    <main className="page app-page stack">
      <h1>Analytics</h1>
      {loading ? <p>Loading…</p> : null}
      {!active ? <p>Create a business first.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {active ? (
        <section className="card">
          <p className="muted">
            Counts are computed from append-only events. IP addresses are not stored.
          </p>
          {Object.keys(counts).length === 0 ? (
            <p>No events yet. Open the public profile to record a view.</p>
          ) : (
            <ul>
              {Object.entries(counts).map(([key, value]) => (
                <li key={key}>
                  {key}: {value}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </main>
  );
}
