import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenant } from "../../dashboard/useTenant";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import { listBranches } from "../../lib/dashboardApi";
import type { AnalyticsEventRecord, Branch, Touchpoint } from "../../lib/types";

type Stat = { label: string; value: number | string; delta?: number | null };

type RangeKey = "7d" | "30d" | "all";

type BranchFilter = "all" | "unassigned" | string;

const LABELS: Record<string, string> = {
  PROFILE_VIEW: "Profile views",
  NFC_TAP: "NFC taps",
  QR_SCAN: "QR scans",
  WEBSITE_CLICK: "Website clicks",
  WHATSAPP_CLICK: "WhatsApp clicks",
  CALL_CLICK: "Call clicks",
  DIRECTIONS_CLICK: "Directions clicks",
  REVIEW_CLICK: "Review clicks",
};

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isNaN(t) ? null : new Date(t);
}

function formatDay(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function exportCsv(rows: AnalyticsEventRecord[]): void {
  const header = ["event_type", "source", "branch_id", "touchpoint_id", "link_id", "created_at"];
  const lines = [header.join(",")];
  rows.forEach((row) => {
    const vals = [
      row.event_type ?? "",
      row.source ?? "",
      row.branch_id ?? "",
      row.touchpoint_id ?? "",
      row.link_id ?? "",
      row.created_at ?? "",
    ];
    lines.push(vals.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "analytics-events.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function AnalyticsPage() {
  const { active, loading } = useTenant();
  const [events, setEvents] = useState<AnalyticsEventRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [range, setRange] = useState<RangeKey>("7d");
  const [branchFilter, setBranchFilter] = useState<BranchFilter>("all");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [touchpoints, setTouchpoints] = useState<Touchpoint[]>([]);

  const branchMap = useMemo(() => {
    const map = new Map<string, Branch>();
    branches.forEach((b) => map.set(b.id, b));
    return map;
  }, [branches]);

  const touchpointMap = useMemo(() => {
    const map = new Map<string, Touchpoint>();
    touchpoints.forEach((tp) => map.set(tp.id, tp));
    return map;
  }, [touchpoints]);

  const loadTouchpoints = useCallback(async (businessId: string): Promise<Touchpoint[]> => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return [];
    const { data, error: tpError } = await supabase
      .from("touchpoints")
      .select("id,label,channel,branch_id")
      .eq("business_id", businessId);
    if (tpError) {
      setError((prev) => prev ?? tpError.message);
      return [];
    }
    return (data as Touchpoint[] | null) ?? [];
  }, []);

  const loadMeta = useCallback(async () => {
    if (!active) {
      setBranches([]);
      setTouchpoints([]);
      return;
    }
    setError(null);
    try {
      const [branchRows, tpRows] = await Promise.all([
        listBranches(active.business_id),
        loadTouchpoints(active.business_id),
      ]);
      setBranches(branchRows);
      setTouchpoints(tpRows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to load metadata";
      setError(msg);
    }
  }, [active, loadTouchpoints]);

  const loadEvents = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !active) {
      setEvents([]);
      return;
    }
    setPending(true);
    setError(null);
    let query = supabase
      .from("analytics_events")
      .select("event_type, created_at, source, touchpoint_id, link_id, branch_id")
      .eq("business_id", active.business_id)
      .order("created_at", { ascending: false });

    if (branchFilter !== "all") {
      if (branchFilter === "unassigned") {
        query = query.is("branch_id", null);
      } else {
        query = query.eq("branch_id", branchFilter);
      }
    }

    const { data, error: queryError } = await query;
    setPending(false);
    if (queryError) {
      setError(queryError.message);
      setEvents([]);
      return;
    }
    setEvents((data as AnalyticsEventRecord[] | null) ?? []);
  }, [active, branchFilter]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const filtered = useMemo(() => {
    if (range === "all") return events;
    const days = range === "7d" ? 7 : 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return events.filter((item) => {
      const d = parseDate(item.created_at ?? undefined);
      return d ? d.getTime() >= cutoff : true;
    });
  }, [events, range]);

  const previousWindow = useMemo(() => {
    if (range === "all") return [] as AnalyticsEventRecord[];
    const days = range === "7d" ? 7 : 30;
    const end = Date.now() - days * 24 * 60 * 60 * 1000;
    const start = end - days * 24 * 60 * 60 * 1000;
    return events.filter((item) => {
      const d = parseDate(item.created_at ?? undefined);
      if (!d) return false;
      const t = d.getTime();
      return t >= start && t < end;
    });
  }, [events, range]);

  const stats: Stat[] = useMemo(() => {
    const total = filtered.length;
    const prevTotal = previousWindow.length;
    const latest = parseDate(events[0]?.created_at)?.toLocaleString() ?? "—";
    const delta = prevTotal === 0 ? null : Number(((total - prevTotal) / Math.max(prevTotal, 1)).toFixed(2));
    return [
      { label: "Events", value: total, delta },
      { label: "Event types", value: new Set(filtered.map((e) => e.event_type)).size },
      { label: "Latest event", value: latest },
    ];
  }, [filtered, events, previousWindow]);

  const typeBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const evt of filtered) {
      const key = evt.event_type || "unknown";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    const total = filtered.length || 1;
    return Array.from(map.entries())
      .map(([key, value]) => ({ key, label: LABELS[key] ?? key, value, percent: Math.round((value / total) * 100) }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const channelBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const evt of filtered) {
      const src = (evt.source as string | null) ?? "unknown";
      map.set(src, (map.get(src) ?? 0) + 1);
    }
    const total = filtered.length || 1;
    return Array.from(map.entries())
      .map(([key, value]) => ({ key, value, percent: Math.round((value / total) * 100) }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const branchBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const evt of filtered) {
      const key = evt.branch_id ?? "unassigned";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    const total = filtered.length || 1;
    return Array.from(map.entries())
      .map(([key, value]) => ({
        key,
        label: key === "unassigned" ? "Unassigned" : branchMap.get(key)?.name ?? "Branch",
        value,
        percent: Math.round((value / total) * 100),
      }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, branchMap]);

  const touchpointBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const evt of filtered) {
      if (!evt.touchpoint_id) continue;
      map.set(evt.touchpoint_id, (map.get(evt.touchpoint_id) ?? 0) + 1);
    }
    const total = filtered.length || 1;
    return Array.from(map.entries())
      .map(([key, value]) => ({
        key,
        label: touchpointMap.get(key)?.label || touchpointMap.get(key)?.channel?.toUpperCase() || "Touchpoint",
        value,
        percent: Math.round((value / total) * 100),
      }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, touchpointMap]);

  const trend = useMemo(() => {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 30;
    const today = new Date();
    const buckets: { label: string; value: number }[] = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setHours(0, 0, 0, 0);
      d.setDate(today.getDate() - i);
      const label = formatDay(d);
      const count = filtered.filter((evt) => {
        const dt = parseDate(evt.created_at ?? undefined);
        if (!dt) return false;
        const sameDay =
          dt.getFullYear() === d.getFullYear() && dt.getMonth() === d.getMonth() && dt.getDate() === d.getDate();
        return sameDay;
      }).length;
      buckets.push({ label, value: count });
    }
    const max = Math.max(1, ...buckets.map((b) => b.value));
    return { buckets, max };
  }, [filtered, range]);

  const total = filtered.length;
  const emptyState = !pending && total === 0;

  return (
    <main className="page app-page stack">
      <header className="page-header">
        <p className="eyebrow">Analytics</p>
        <h1>Engagement insights</h1>
        <p className="muted">Event data from Supabase analytics_events, filtered by date and branch.</p>
        <div className="pill-group" role="group" aria-label="Date range">
          {[
            { key: "7d", label: "7d" },
            { key: "30d", label: "30d" },
            { key: "all", label: "All" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              className={range === item.key ? "pill active" : "pill"}
              onClick={() => setRange(item.key as RangeKey)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="muted" style={{ display: "inline-flex", gap: "0.5rem", alignItems: "center" }}>
          Branch
          <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value as BranchFilter)}>
            <option value="all">All branches</option>
            <option value="unassigned">Unassigned</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <div className="pill-group" role="group" aria-label="Exports and comparisons">
          <button className="button secondary" type="button" onClick={() => exportCsv(filtered)} disabled={filtered.length === 0}>
            Export CSV
          </button>
          <span className="meta">Comparisons vs previous window shown in summary.</span>
        </div>
        {loading ? <p className="muted">Loading tenant…</p> : null}
        {pending ? <p className="muted">Loading events…</p> : null}
        {error ? <p className="notice danger">{error}</p> : null}
      </header>

      <section className="stat-grid" aria-label="Analytics summary">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <span className="label">{stat.label}</span>
            <span className="stat-value">{stat.value}</span>
            {stat.delta !== undefined ? (
              <span className="meta">
                {stat.delta === null ? "—" : stat.delta >= 0 ? `+${(stat.delta * 100).toFixed(0)}%` : `${(stat.delta * 100).toFixed(0)}%`}
              </span>
            ) : null}
          </div>
        ))}
      </section>

      {pending ? (
        <section className="card-grid" aria-label="Analytics loading">
          {[...Array(2)].map((_, index) => (
            <div key={index} className="skeleton-card" role="status">
              <div className="loading-block" />
              <div className="loading-block" />
              <div className="loading-block" />
            </div>
          ))}
        </section>
      ) : null}

      {emptyState ? (
        <section className="card stack empty-state" role="status">
          <h3>No events yet</h3>
          <p>Publish your profile and deploy QR/NFC touchpoints to start seeing activity.</p>
        </section>
      ) : null}

      {!emptyState ? (
        <section className="card stack" aria-label="Trend">
          <div className="split">
            <div>
              <h2>Daily trend</h2>
              <p className="muted">Events in the selected window</p>
            </div>
            <span className="meta">Bars show counts per day</span>
          </div>
          <div className="bar-chart" role="img" aria-label="Events per day">
            {trend.buckets.map((bucket) => {
              const height = trend.max === 0 ? 0 : Math.round((bucket.value / trend.max) * 100);
              return (
                <div key={bucket.label} className="bar" title={`${bucket.label}: ${bucket.value}`}>
                  <div className="bar-fill" style={{ height: `${height}%` }} />
                  <span className="bar-label">{bucket.label}</span>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {!emptyState ? (
        <section className="card-grid">
          <section className="card stack" aria-label="Event breakdown">
            <div className="section-header">
              <h2>Event breakdown</h2>
              <p className="muted">Top event types</p>
            </div>
            <ul className="list">
              {typeBreakdown.map((row) => (
                <li key={row.key} className="list-row">
                  <span>{row.label}</span>
                  <span className="badge">
                    {row.value} · {row.percent}%
                  </span>
                </li>
              ))}
              {typeBreakdown.length === 0 ? <p className="muted">No events yet.</p> : null}
            </ul>
          </section>

          <section className="card stack" aria-label="Source performance">
            <div className="section-header">
              <h2>Channel performance</h2>
              <p className="muted">Counts by source</p>
            </div>
            <ul className="list">
              {channelBreakdown.map((row) => (
                <li key={row.key} className="list-row">
                  <span>{row.key}</span>
                  <span className="badge">
                    {row.value} · {row.percent}%
                  </span>
                </li>
              ))}
              {channelBreakdown.length === 0 ? <p className="muted">No source data.</p> : null}
            </ul>
          </section>
        </section>
      ) : null}

      {!emptyState ? (
        <section className="card-grid">
          <section className="card stack" aria-label="Branch performance">
            <div className="section-header">
              <h2>Branch performance</h2>
              <p className="muted">Distribution by branch</p>
            </div>
            <ul className="list">
              {branchBreakdown.map((row) => (
                <li key={row.key} className="list-row">
                  <span>{row.label}</span>
                  <span className="badge">
                    {row.value} · {row.percent}%
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card stack" aria-label="Touchpoint performance">
            <div className="section-header">
              <h2>Touchpoint performance</h2>
              <p className="muted">Top touchpoints</p>
            </div>
            <ul className="list">
              {touchpointBreakdown.map((row) => (
                <li key={row.key} className="list-row">
                  <span>{row.label}</span>
                  <span className="badge">
                    {row.value} · {row.percent}%
                  </span>
                </li>
              ))}
              {touchpointBreakdown.length === 0 ? <p className="muted">No touchpoint data.</p> : null}
            </ul>
          </section>
        </section>
      ) : null}
    </main>
  );
}
