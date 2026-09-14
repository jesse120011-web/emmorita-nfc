import { useState } from "react";
import { useTenant } from "../../dashboard/TenantProvider";
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

  return (
    <main className="page app-page stack">
      <h1>Settings</h1>
      {loading ? <p>Loading…</p> : null}
      {!active ? <p>Create a business first.</p> : null}
      {active?.businesses ? (
        <section className="card stack">
          <p>Slug: {active.businesses.slug}</p>
          <p>Country: {active.businesses.country_code}</p>
          <p>Status: {active.businesses.status}</p>
          <p className="muted">
            Public access requires status <code>active</code> and a published profile. Billing is
            not implemented; <code>plan_key</code> defaults to free.
          </p>
          <button className="button" type="button" onClick={() => void setStatus("active")}>
            Activate business
          </button>
          <button className="button secondary" type="button" onClick={() => void setStatus("draft")}>
            Return to draft
          </button>
          {message ? <p>{message}</p> : null}
        </section>
      ) : null}
    </main>
  );
}
