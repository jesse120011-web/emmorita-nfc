import { useState } from "react";
import { useTenant } from "../../dashboard/useTenant";
import { getSupabaseBrowserClient } from "../../lib/supabase";

export function SettingsPage() {
  const { active, loading, refresh } = useTenant();
  const [message, setMessage] = useState<string | null>(null);

  async function setStatus(status: "draft" | "active" | "suspended") {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !active) {
      return;
    }
    const { error } = await supabase
      .from("businesses")
      .update({ status })
      .eq("id", active.business_id);
    setMessage(error ? error.message : `Status set to ${status}.`);
    await refresh();
  }

  const business = active?.businesses;
  const isStatus = (state: string) => business?.status === state;

  return (
    <main className="page app-page stack">
      <header className="page-header">
        <p className="eyebrow">Settings</p>
        <h1>Workspace settings</h1>
        <p className="muted">
          Organize publishing and access. Only live controls are shown; future sections stay disabled until backend
          support lands.
        </p>
      </header>

      {loading ? (
        <section className="card skeleton-card" aria-label="Loading settings">
          <div className="loading-block" />
          <div className="loading-block" />
        </section>
      ) : null}

      {!active ? (
        <section className="card stack empty-state" role="status">
          <h3>Select a business</h3>
          <p className="muted">Settings are scoped to a business. Choose one in Overview.</p>
        </section>
      ) : null}

      {business ? (
        <section className="card stack" aria-label="Business status">
          <div className="section-header">
            <h2>Business status</h2>
            <span className="pill">/t/{business.slug}</span>
          </div>
          <div className="grid-two">
            <div className="stack">
              <p className="muted">Country: {business.country_code ?? "—"}</p>
              <p className="muted">Status: {business.status}</p>
              <p className="muted">
                Public access requires status <code>active</code> and a published profile. Billing is not implemented;
                <code>plan_key</code> defaults to free.
              </p>
            </div>
            <div className="stack">
              <button
                className="button"
                type="button"
                disabled={isStatus("active")}
                onClick={() => void setStatus("active")}
              >
                Activate business
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={isStatus("draft")}
                onClick={() => void setStatus("draft")}
              >
                Return to draft
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={isStatus("suspended")}
                onClick={() => void setStatus("suspended")}
              >
                Suspend access
              </button>
            </div>
          </div>
          {message ? <p className="notice">{message}</p> : null}
        </section>
      ) : null}
    </main>
  );
}
