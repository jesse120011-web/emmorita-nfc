import { useCallback, useEffect, useMemo, useState } from "react";
import { useTenant } from "../../dashboard/useTenant";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import { assignTouchpointBranch, listBranches } from "../../lib/dashboardApi";
import type { Branch, Touchpoint } from "../../lib/types";

type QrRow = { id: string; label: string | null; status: string };
type NfcRow = { id: string; label: string | null; status: string; hardware_uid: string | null; public_token: string };

type QrState = { rows: QrRow[]; error: string | null; pending: boolean };
type NfcState = { rows: NfcRow[]; error: string | null; pending: boolean };

type BranchOption = { id: string; label: string };

export function TouchpointsPage() {
  const { active, loading } = useTenant();
  const [touchpoints, setTouchpoints] = useState<Touchpoint[]>([]);
  const [tpPending, setTpPending] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchPending, setBranchPending] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrState, setQrState] = useState<QrState>({ rows: [], error: null, pending: false });
  const [nfcState, setNfcState] = useState<NfcState>({ rows: [], error: null, pending: false });

  const canMutate = useMemo(() => active?.role === "owner" || active?.role === "admin", [active]);

  const loadBranches = useCallback(async () => {
    if (!active) {
      setBranches([]);
      return;
    }
    setBranchPending(true);
    try {
      const rows = await listBranches(active.business_id);
      setBranches(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to load branches";
      setError(msg);
    } finally {
      setBranchPending(false);
    }
  }, [active]);

  const loadTouchpoints = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !active) {
      setTouchpoints([]);
      return;
    }
    setTpPending(true);
    setError(null);
    const { data, error: queryError } = await supabase
      .from("touchpoints")
      .select("id,business_id,label,channel,status,public_token,qr_code_id,nfc_tag_id,branch_id,created_at")
      .eq("business_id", active.business_id)
      .order("created_at", { ascending: false });
    setTpPending(false);
    if (queryError) {
      setError(queryError.message);
      setTouchpoints([]);
      return;
    }
    setTouchpoints((data as Touchpoint[] | null) ?? []);
  }, [active]);

  const loadQrAssets = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !active) {
      setQrState({ rows: [], error: null, pending: false });
      return;
    }
    const { data, error: queryError } = await supabase
      .from("qr_codes")
      .select("id, label, status")
      .eq("business_id", active.business_id)
      .is("deleted_at", null);
    setQrState({ rows: (data as QrRow[] | null) ?? [], error: queryError ? queryError.message : null, pending: false });
  }, [active]);

  const loadNfcAssets = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !active) {
      setNfcState({ rows: [], error: null, pending: false });
      return;
    }
    setNfcState((current) => ({ ...current, pending: true, error: null }));
    const { data, error: queryError } = await supabase
      .from("nfc_tags")
      .select("id,label,status,hardware_uid,public_token")
      .eq("business_id", active.business_id);
    setNfcState({ rows: (data as NfcRow[] | null) ?? [], error: queryError ? queryError.message : null, pending: false });
  }, [active]);

  useEffect(() => {
    void loadBranches();
    void loadTouchpoints();
    void loadQrAssets();
    void loadNfcAssets();
  }, [loadBranches, loadTouchpoints, loadQrAssets, loadNfcAssets]);

  async function addCode() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !active) {
      return;
    }
    setQrState((current) => ({ ...current, pending: true, error: null }));
    const { data, error: insertError } = await supabase
      .from("qr_codes")
      .insert({
        business_id: active.business_id,
        label: `QR ${qrState.rows.length + 1}`,
        status: "active",
      })
      .select("id, label, status")
      .single();
    setQrState((current) => ({ ...current, pending: false }));
    if (insertError) {
      setQrState((current) => ({ ...current, error: insertError.message }));
      return;
    }
    setQrState((current) => ({ ...current, rows: [...current.rows, data as QrRow] }));
    await loadTouchpoints();
  }

  async function onAssign(touchpointId: string, branchId: string | null) {
    if (!active) return;
    setAssigning(touchpointId);
    setError(null);
    try {
      await assignTouchpointBranch({ businessId: active.business_id, touchpointId, branchId });
      await loadTouchpoints();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to assign branch";
      setError(msg);
    } finally {
      setAssigning(null);
    }
  }

  const branchOptions: BranchOption[] = useMemo(
    () => [{ id: "", label: "Unassigned" }, ...branches.map((b) => ({ id: b.id, label: b.name }))],
    [branches]
  );

  return (
    <main className="page app-page stack">
      <header className="page-header">
        <p className="eyebrow">Touchpoints</p>
        <h1>QR & NFC deployment</h1>
        <p className="muted">
          Manage the physical entry points that drive customers to your digital profile. Assign each touchpoint to a
          branch for accurate analytics and operations.
        </p>
      </header>

      {(loading || tpPending || branchPending) && (
        <section className="card-grid" aria-label="Loading touchpoints">
          {[...Array(2)].map((_, index) => (
            <div key={index} className="skeleton-card" role="status">
              <div className="loading-block" />
              <div className="loading-block" />
              <div className="loading-block" />
            </div>
          ))}
        </section>
      )}

      {error ? (
        <section className="notice danger" role="alert">
          {error}
        </section>
      ) : null}

      {!active ? (
        <section className="card stack empty-state" role="status">
          <h3>Connect a business</h3>
          <p className="muted">Register and assign touchpoints after selecting or creating a business in Overview.</p>
        </section>
      ) : null}

      {active ? (
        <div className="card-grid">
          <section className="card stack" aria-label="Touchpoint list">
            <div className="section-header">
              <div>
                <p className="eyebrow">Registered touchpoints</p>
                <h2>Assign to branches</h2>
              </div>
              <span className="pill">{touchpoints.length} total</span>
            </div>
            {touchpoints.length === 0 ? <p className="muted">No touchpoints yet.</p> : null}
            <ul className="list">
              {touchpoints.map((tp) => (
                <li key={tp.id} className="list-row" aria-label="Touchpoint row">
                  <div className="stack">
                    <strong>{tp.label || `${tp.channel.toUpperCase()} touchpoint`}</strong>
                    <span className="muted">Channel: {tp.channel.toUpperCase()}</span>
                    <span className="meta">Status: {tp.status}</span>
                  </div>
                  <div className="stack" style={{ minWidth: "220px" }}>
                    <label className="muted" htmlFor={`branch-${tp.id}`}>
                      Branch
                    </label>
                    <select
                      id={`branch-${tp.id}`}
                      value={tp.branch_id ?? ""}
                      onChange={(e) => void onAssign(tp.id, e.target.value || null)}
                      disabled={!canMutate || assigning === tp.id}
                    >
                      {branchOptions.map((b) => (
                        <option key={b.id || "none"} value={b.id}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                    {assigning === tp.id ? <span className="meta">Updating…</span> : null}
                  </div>
                </li>
              ))}
            </ul>
            <p className="muted">Branch assignment is enforced by the backend for tenant integrity.</p>
          </section>

          <section className="card stack" aria-label="QR codes">
            <div className="section-header">
              <div>
                <p className="eyebrow">QR codes</p>
                <h2>Print and deploy</h2>
              </div>
              <span className="pill">Destination: /t/{active.businesses?.slug}?src=qr</span>
            </div>
            <p className="muted">Register and print QR assets that open your public profile.</p>
            <ul className="list">
              {qrState.rows.map((row) => (
                <li key={row.id} className="list-row">
                  <span>{row.label ?? "QR asset"}</span>
                  <span className="badge">{row.status}</span>
                </li>
              ))}
            </ul>
            {qrState.rows.length === 0 ? <p className="muted">No QR assets yet.</p> : null}
            {qrState.error ? <p className="notice danger">{qrState.error}</p> : null}
            <div className="split">
              <button
                className="button"
                type="button"
                onClick={() => void addCode()}
                disabled={active.role === "staff" || qrState.pending}
              >
                {qrState.pending ? "Registering…" : "Register QR asset"}
              </button>
              {active.role === "staff" ? <span className="muted">Staff can view but not register assets.</span> : null}
            </div>
          </section>

          <section className="card stack" aria-label="NFC tags">
            <div className="section-header">
              <div>
                <p className="eyebrow">NFC tags</p>
                <h2>Provision and encode</h2>
              </div>
              <span className="pill">Destination: /t/{active.businesses?.slug}?src=nfc</span>
            </div>
            <p className="muted">Provisioned tags resolve to your live profile for tap experiences.</p>
            {nfcState.error ? <p className="notice danger">{nfcState.error}</p> : null}
            {nfcState.pending ? (
              <div className="skeleton-card" role="status">
                <div className="loading-block" />
                <div className="loading-block" />
              </div>
            ) : null}
            <ul className="list">
              {nfcState.rows.map((row) => (
                <li key={row.id} className="list-row">
                  <div className="stack">
                    <strong>{row.label ?? "NFC tag"}</strong>
                    <span className="meta">UID: {row.hardware_uid ?? "—"}</span>
                    <span className="meta">Token: {row.public_token ? `${row.public_token.slice(0, 8)}…` : "—"}</span>
                  </div>
                  <span className="badge">{row.status}</span>
                </li>
              ))}
            </ul>
            {nfcState.rows.length === 0 && !nfcState.pending ? (
              <p className="muted">No NFC tags yet. Provision hardware to start tracking taps.</p>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}
