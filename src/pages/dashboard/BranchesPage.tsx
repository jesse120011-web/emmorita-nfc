import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useTenant } from "../../dashboard/useTenant";
import { createBranch, listBranches, updateBranch } from "../../lib/dashboardApi";
import type { Branch } from "../../lib/types";

const emptyForm = {
  name: "",
  slug: "",
  address: "",
  city: "",
  timezone: "Africa/Nairobi",
  is_default: false,
};

type BranchForm = typeof emptyForm;

export function BranchesPage() {
  const { active, loading } = useTenant();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [listPending, setListPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<BranchForm>(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<BranchForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const canEdit = useMemo(() => active?.role === "owner" || active?.role === "admin", [active]);

  const loadBranches = useCallback(async () => {
    if (!active) {
      setBranches([]);
      setSelectedId(null);
      return;
    }
    setListPending(true);
    setError(null);
    try {
      const rows = await listBranches(active.business_id);
      setBranches(rows);
      setSelectedId((current) => current ?? rows[0]?.id ?? null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to load branches";
      setError(msg);
    } finally {
      setListPending(false);
    }
  }, [active]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    const current = branches.find((b) => b.id === selectedId);
    if (current) {
      setEditForm({
        name: current.name,
        slug: current.slug ?? "",
        address: current.address ?? "",
        city: current.city ?? "",
        timezone: current.timezone ?? "Africa/Nairobi",
        is_default: Boolean(current.is_default),
      });
    }
  }, [branches, selectedId]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active || !canEdit) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const payload = {
        ...createForm,
        business_id: active.business_id,
        country_code: active.businesses?.country_code ?? "KE",
        name: createForm.name.trim(),
        slug: createForm.slug.trim() || undefined,
      };
      const row = await createBranch(active.business_id, payload);
      setCreateForm(emptyForm);
      setMessage(`Created branch ${row.name}`);
      await loadBranches();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not create branch";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function onUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active || !canEdit || !selectedId) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await updateBranch(active.business_id, selectedId, {
        ...editForm,
        name: editForm.name.trim(),
        slug: editForm.slug.trim() || null,
      });
      setMessage("Branch updated");
      await loadBranches();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not update branch";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page app-page stack">
      <header className="page-header">
        <p className="eyebrow">Branches</p>
        <h1>Locations</h1>
        <p className="muted">
          Manage branches/locations, default routing, and per-branch touchpoint attribution. Owner/Admin can edit; staff
          can view.
        </p>
      </header>

      {loading || listPending ? (
        <section className="card skeleton-card" aria-label="Loading branches">
          <div className="loading-block" />
          <div className="loading-block" />
        </section>
      ) : null}

      {error ? (
        <section className="notice danger" role="alert">
          {error}
        </section>
      ) : null}

      {!active ? (
        <section className="card stack empty-state" role="status">
          <h3>Select a business</h3>
          <p className="muted">Branches live within a business. Choose or create one in Overview.</p>
        </section>
      ) : null}

      {active ? (
        <section className="card stack" aria-label="Branch list">
          <div className="section-header">
            <div>
              <p className="eyebrow">Current branches</p>
              <h2>Locations and routing</h2>
            </div>
            <span className="pill">Role: {active.role}</span>
          </div>
          {branches.length === 0 ? <p className="muted">No branches yet. Create one below.</p> : null}
          <ul className="list">
            {branches.map((branch) => (
              <li key={branch.id} className={branch.id === selectedId ? "list-row active" : "list-row"}>
                <div className="stack">
                  <strong>{branch.name}</strong>
                  <span className="muted">
                    {branch.city ? `${branch.city} · ` : ""}
                    {branch.address || "No address"}
                  </span>
                  <span className="meta">{branch.timezone || "Timezone not set"}</span>
                </div>
                <div className="stack" style={{ alignItems: "flex-end" }}>
                  {branch.is_default ? <span className="badge">Default</span> : null}
                  <button
                    className="button ghost"
                    type="button"
                    onClick={() => setSelectedId(branch.id)}
                    disabled={saving}
                  >
                    {branch.id === selectedId ? "Selected" : "Edit"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {active ? (
        <section className="card grid-two" aria-label="Branch forms">
          <form className="stack" onSubmit={(event) => void onUpdate(event)} aria-label="Edit branch">
            <div className="section-header">
              <div>
                <p className="eyebrow">Edit</p>
                <h3>Selected branch</h3>
              </div>
              <select value={selectedId ?? ""} onChange={(e) => setSelectedId(e.target.value || null)}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            {selectedId ? (
              <>
                <label>
                  Name
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                    disabled={!canEdit}
                  />
                </label>
                <label>
                  Slug
                  <input
                    value={editForm.slug}
                    onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                    placeholder="Optional URL slug"
                    disabled={!canEdit}
                  />
                </label>
                <label>
                  Address
                  <input
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    placeholder="Street, building"
                    disabled={!canEdit}
                  />
                </label>
                <label>
                  City
                  <input
                    value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    placeholder="City"
                    disabled={!canEdit}
                  />
                </label>
                <label>
                  Timezone
                  <input
                    value={editForm.timezone}
                    onChange={(e) => setEditForm({ ...editForm, timezone: e.target.value })}
                    placeholder="Africa/Nairobi"
                    disabled={!canEdit}
                  />
                </label>
                <label className="inline">
                  <input
                    type="checkbox"
                    checked={editForm.is_default}
                    onChange={(e) => setEditForm({ ...editForm, is_default: e.target.checked })}
                    disabled={!canEdit}
                  />
                  Default branch for new touchpoints
                </label>
                <button className="button" type="submit" disabled={!canEdit || saving}>
                  {saving ? "Saving…" : "Save branch"}
                </button>
              </>
            ) : (
              <p className="muted">Select a branch to edit.</p>
            )}
          </form>

          <form className="stack" onSubmit={(event) => void onCreate(event)} aria-label="Create branch">
            <div className="section-header">
              <div>
                <p className="eyebrow">Create</p>
                <h3>New branch</h3>
              </div>
            </div>
            <label>
              Name
              <input
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                required
                disabled={!canEdit}
              />
            </label>
            <label>
              Slug
              <input
                value={createForm.slug}
                onChange={(e) => setCreateForm({ ...createForm, slug: e.target.value })}
                placeholder="Optional URL slug"
                disabled={!canEdit}
              />
            </label>
            <label>
              Address
              <input
                value={createForm.address}
                onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                placeholder="Street, building"
                disabled={!canEdit}
              />
            </label>
            <label>
              City
              <input
                value={createForm.city}
                onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                placeholder="City"
                disabled={!canEdit}
              />
            </label>
            <label>
              Timezone
              <input
                value={createForm.timezone}
                onChange={(e) => setCreateForm({ ...createForm, timezone: e.target.value })}
                placeholder="Africa/Nairobi"
                disabled={!canEdit}
              />
            </label>
            <label className="inline">
              <input
                type="checkbox"
                checked={createForm.is_default}
                onChange={(e) => setCreateForm({ ...createForm, is_default: e.target.checked })}
                disabled={!canEdit}
              />
              Set as default branch
            </label>
            <button className="button" type="submit" disabled={!canEdit || saving}>
              {saving ? "Saving…" : "Create branch"}
            </button>
            {!canEdit ? <p className="muted">Only owners/admins can create branches.</p> : null}
          </form>
        </section>
      ) : null}

      {message ? <p className="notice success">{message}</p> : null}
    </main>
  );
}
