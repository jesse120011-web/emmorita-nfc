import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useTenant } from "../../dashboard/useTenant";
import { getReputationSettings, saveReputationSettings } from "../../lib/dashboardApi";
import type { ReputationSettings } from "../../lib/types";

const emptyForm: ReputationSettings = {
  business_id: "",
  primary_platform: null,
  review_url: null,
  feedback_instructions: null,
};

export function ReputationPage() {
  const { active, loading } = useTenant();
  const [form, setForm] = useState<ReputationSettings>(emptyForm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const canEdit = useMemo(() => active?.role === "owner" || active?.role === "admin", [active]);

  const loadSettings = useCallback(async () => {
    if (!active) {
      setLoaded(false);
      setForm(emptyForm);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const data = await getReputationSettings(active.business_id);
      setForm({
        business_id: active.business_id,
        primary_platform: data?.primary_platform ?? null,
        review_url: data?.review_url ?? null,
        feedback_instructions: data?.feedback_instructions ?? null,
        updated_at: data?.updated_at,
      });
      setLoaded(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to load reputation settings";
      setError(msg);
    } finally {
      setPending(false);
    }
  }, [active]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active || !canEdit) return;
    setPending(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await saveReputationSettings(active.business_id, {
        primary_platform: form.primary_platform,
        review_url: form.review_url,
        feedback_instructions: form.feedback_instructions,
      });
      setForm({ ...saved });
      setMessage("Reputation settings saved");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save settings";
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="page app-page stack">
      <header className="page-header">
        <p className="eyebrow">Reputation</p>
        <h1>Reviews & feedback</h1>
        <p className="muted">
          Configure where customers leave reviews and how you request feedback. Settings are stored per business and
          enforced by backend authorization.
        </p>
      </header>

      {(loading || pending) && (
        <section className="card skeleton-card" aria-label="Loading reputation state">
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
          <h3>Select a business</h3>
          <p className="muted">Reputation lives per business. Choose one in Overview to continue.</p>
        </section>
      ) : null}

      {active ? (
        <section className="card stack" aria-label="Reputation configuration">
          <div className="section-header">
            <div>
              <p className="eyebrow">Capture</p>
              <h2>Review destinations</h2>
              <p className="muted">Primary platform and direct review URL are used by public actions and follow-up.</p>
            </div>
            <span className="pill">Role: {active.role}</span>
          </div>
          {!loaded ? <p className="muted">Loading reputation state…</p> : null}
          <form className="stack" onSubmit={(event) => void onSubmit(event)}>
            <label>
              Primary platform
              <input
                value={form.primary_platform ?? ""}
                onChange={(e) => setForm({ ...form, primary_platform: e.target.value || null })}
                placeholder="google, facebook, tripadvisor"
                disabled={!canEdit}
              />
            </label>
            <label>
              Review URL
              <input
                value={form.review_url ?? ""}
                onChange={(e) => setForm({ ...form, review_url: e.target.value || null })}
                placeholder="https://example.com/review"
                disabled={!canEdit}
              />
            </label>
            <label>
              Feedback instructions
              <textarea
                value={form.feedback_instructions ?? ""}
                onChange={(e) => setForm({ ...form, feedback_instructions: e.target.value || null })}
                placeholder="Tell customers how to leave feedback"
                disabled={!canEdit}
              />
            </label>
            <button className="button" type="submit" disabled={!canEdit || pending}>
              {pending ? "Saving…" : "Save reputation settings"}
            </button>
            {!canEdit ? <p className="muted">Only owners/admins can update reputation settings.</p> : null}
            {message ? <p className="notice">{message}</p> : null}
          </form>
        </section>
      ) : null}
    </main>
  );
}
