import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useTenant } from "../../dashboard/useTenant";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import {
  createCustomer,
  listBranches,
  listCustomers,
  updateCustomer,
} from "../../lib/dashboardApi";
import type {
  Branch,
  Customer,
  CustomerEventType,
  CustomerSource,
  CustomerStatus,
  Touchpoint,
} from "../../lib/types";

const emptyForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  branch_id: "",
  touchpoint_id: "",
  status: "lead" as CustomerStatus,
  source: "unknown" as CustomerSource,
  notes: "",
};

type CustomerForm = typeof emptyForm;

type TimelineRow = {
  id: string;
  event_type: CustomerEventType;
  summary: string;
  created_at: string | null;
  touchpoint_id: string | null;
};

export function CustomersPage() {
  const { active, loading } = useTenant();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [touchpoints, setTouchpoints] = useState<Touchpoint[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<TimelineRow[]>([]);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const touchpointMap = useMemo(() => {
    const map = new Map<string, Touchpoint>();
    touchpoints.forEach((tp) => map.set(tp.id, tp));
    return map;
  }, [touchpoints]);

  const branchMap = useMemo(() => {
    const map = new Map<string, Branch>();
    branches.forEach((b) => map.set(b.id, b));
    return map;
  }, [branches]);

  const loadData = useCallback(async () => {
    if (!active) {
      setCustomers([]);
      setBranches([]);
      setTouchpoints([]);
      setTimeline([]);
      return;
    }
    setPending(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();

    try {
      const [branchRows, customerRows] = await Promise.all([
        listBranches(active.business_id),
        listCustomers(active.business_id),
      ]);
      setBranches(branchRows);
      setCustomers(customerRows);
      setSelectedId((current) => current ?? customerRows[0]?.id ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to load customers";
      setError(msg);
    }

    if (supabase && active) {
      const { data, error: tpError } = await supabase
        .from("touchpoints")
        .select("id,business_id,label,channel,status,branch_id")
        .eq("business_id", active.business_id);
      if (tpError) {
        setError((prev) => prev ?? tpError.message);
      }
      setTouchpoints((data as Touchpoint[] | null) ?? []);
    }

    setPending(false);
  }, [active]);

  const loadTimeline = useCallback(async () => {
    if (!active || !selectedId) {
      setTimeline([]);
      setTimelineError(null);
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    try {
      const { data, error: queryError } = await supabase
        .from("customer_events")
        .select("id,event_type,summary,created_at,touchpoint_id")
        .eq("business_id", active.business_id)
        .eq("customer_id", selectedId)
        .order("created_at", { ascending: false })
        .limit(25);
      if (queryError) {
        setTimeline([]);
        setTimelineError(queryError.message);
        return;
      }
      setTimeline((data as TimelineRow[] | null) ?? []);
      setTimelineError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Timeline unavailable";
      setTimelineError(msg);
      setTimeline([]);
    }
  }, [active, selectedId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void loadTimeline();
  }, [loadTimeline]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active) return;
    setMessage(null);
    setError(null);
    setPending(true);
    try {
      const payload: Omit<Customer, "id" | "created_at" | "updated_at"> = {
        business_id: active.business_id,
        branch_id: form.branch_id || null,
        touchpoint_id: form.touchpoint_id || null,
        first_name: form.first_name.trim() || null,
        last_name: form.last_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        status: form.status,
        source: form.source,
        notes: form.notes.trim() || null,
      };
      const created = await createCustomer(payload);
      setCustomers((current) => [created, ...current]);
      setSelectedId(created.id);
      setForm(emptyForm);
      setMessage("Customer captured");
      await loadTimeline();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not create customer";
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  async function onStatusChange(customerId: string, status: CustomerStatus) {
    if (!active) return;
    try {
      const updated = await updateCustomer(customerId, { business_id: active.business_id, status });
      setCustomers((current) => current.map((row) => (row.id === customerId ? { ...row, status: updated.status } : row)));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not update status";
      setError((prev) => prev ?? msg);
    }
  }

  const stats = useMemo(() => {
    const total = customers.length;
    const leads = customers.filter((c) => c.status === "lead").length;
    const activeCount = customers.filter((c) => c.status === "active").length;
    const inactive = customers.filter((c) => c.status === "inactive").length;
    return [
      { label: "Total", value: total },
      { label: "Leads", value: leads },
      { label: "Active", value: activeCount },
      { label: "Inactive", value: inactive },
    ];
  }, [customers]);

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === selectedId) ?? null, [customers, selectedId]);

  return (
    <main className="page app-page stack">
      <header className="page-header">
        <p className="eyebrow">Customers</p>
        <h1>Customer relationships</h1>
        <p className="muted">
          Capture leads from touchpoints, keep branch context, and track simple statuses. Owner/admin/staff can ingest
          customers; edits respect backend authorization.
        </p>
      </header>

      {(loading || pending) && (
        <section className="card skeleton-card" aria-label="Loading customers">
          <div className="loading-block" />
          <div className="loading-block" />
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
          <p className="muted">Create or select a business in Overview to manage customer relationships.</p>
        </section>
      ) : null}

      {active ? (
        <section className="stat-grid" aria-label="Customer summary">
          {stats.map((stat) => (
            <div key={stat.label} className="stat-card">
              <span className="label">{stat.label}</span>
              <span className="stat-value">{stat.value}</span>
            </div>
          ))}
        </section>
      ) : null}

      {active ? (
        <section className="card-grid">
          <section className="card stack" aria-label="Add customer">
            <div className="section-header">
              <div>
                <p className="eyebrow">Capture</p>
                <h2>New customer or lead</h2>
              </div>
              <span className="pill">Role: {active.role}</span>
            </div>
            <form className="stack" onSubmit={(event) => void onCreate(event)}>
              <div className="grid-two">
                <label>
                  First name
                  <input
                    value={form.first_name}
                    onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                    placeholder="Amina"
                  />
                </label>
                <label>
                  Last name
                  <input
                    value={form.last_name}
                    onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    placeholder="Kamau"
                  />
                </label>
              </div>
              <div className="grid-two">
                <label>
                  Email
                  <input
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="customer@example.com"
                  />
                </label>
                <label>
                  Phone
                  <input
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+2547..."
                  />
                </label>
              </div>
              <div className="grid-two">
                <label>
                  Branch
                  <select
                    value={form.branch_id}
                    onChange={(e) => setForm({ ...form, branch_id: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Touchpoint
                  <select
                    value={form.touchpoint_id}
                    onChange={(e) => setForm({ ...form, touchpoint_id: e.target.value })}
                  >
                    <option value="">Not specified</option>
                    {touchpoints.map((tp) => (
                      <option key={tp.id} value={tp.id}>
                        {tp.label || tp.channel.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid-two">
                <label>
                  Status
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CustomerStatus })}>
                    <option value="lead">Lead</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
                <label>
                  Source
                  <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value as CustomerSource })}>
                    <option value="profile">Public profile</option>
                    <option value="qr">QR</option>
                    <option value="nfc">NFC</option>
                    <option value="manual">Manual</option>
                    <option value="import">Import</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>
              </div>
              <label>
                Notes
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Context, request, next step"
                />
              </label>
              <button className="button" type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save customer"}
              </button>
            </form>
            {message ? <p className="notice">{message}</p> : null}
          </section>

          <section className="card stack" aria-label="Customer list">
            <div className="section-header">
              <div>
                <p className="eyebrow">CRM</p>
                <h2>Customers</h2>
                <p className="muted">Branch and touchpoint attribution is shown where available.</p>
              </div>
              <span className="pill">{customers.length} records</span>
            </div>
            {customers.length === 0 ? <p className="muted">No customers yet.</p> : null}
            {customers.length > 0 ? (
              <div className="table-wrapper">
                <table className="data-table" aria-label="Customer table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Contact</th>
                      <th>Branch</th>
                      <th>Touchpoint</th>
                      <th>Status</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => {
                      const branch = customer.branch_id ? branchMap.get(customer.branch_id) : null;
                      const tp = customer.touchpoint_id ? touchpointMap.get(customer.touchpoint_id) : null;
                      return (
                        <tr
                          key={customer.id}
                          className="table-row"
                          onClick={() => setSelectedId(customer.id)}
                          aria-label={`Select ${customer.first_name ?? "customer"}`}
                        >
                          <td>
                            <strong>{customer.first_name || customer.last_name ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() : "Unnamed"}</strong>
                          </td>
                          <td>
                            <div className="stack" style={{ gap: "0.1rem" }}>
                              {customer.email ? <span className="muted">{customer.email}</span> : null}
                              {customer.phone ? <span className="muted">{customer.phone}</span> : null}
                              {customer.notes ? <span className="meta">{customer.notes}</span> : null}
                            </div>
                          </td>
                          <td>{branch ? branch.name : "Unassigned"}</td>
                          <td>{tp ? (tp.label || tp.channel.toUpperCase()) : "—"}</td>
                          <td>
                            <select
                              value={customer.status}
                              onChange={(e) => void onStatusChange(customer.id, e.target.value as CustomerStatus)}
                              disabled={pending}
                            >
                              <option value="lead">Lead</option>
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          </td>
                          <td>{customer.source}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </section>
      ) : null}

      {selectedCustomer ? (
        <section className="card stack" aria-label="Customer timeline">
          <div className="section-header">
            <div>
              <p className="eyebrow">Timeline</p>
              <h2>{selectedCustomer.first_name || selectedCustomer.last_name ? `${selectedCustomer.first_name ?? ""} ${selectedCustomer.last_name ?? ""}`.trim() : "Customer"}</h2>
              <p className="muted">Events stored in `customer_events`.</p>
            </div>
            <span className="pill">Status: {selectedCustomer.status}</span>
          </div>
          {timelineError ? <p className="notice danger">{timelineError}</p> : null}
          {timeline.length === 0 && !timelineError ? <p className="muted">No events yet.</p> : null}
          <div className="timeline">
            {timeline.map((row) => (
              <div key={row.id} className="timeline-row">
                <div className="split" style={{ alignItems: "baseline" }}>
                  <strong>{row.summary}</strong>
                  <span className="badge muted">{row.event_type}</span>
                </div>
                <span className="meta">{row.created_at ?? "Unknown time"}</span>
                {row.touchpoint_id ? <span className="meta">Touchpoint: {row.touchpoint_id}</span> : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
