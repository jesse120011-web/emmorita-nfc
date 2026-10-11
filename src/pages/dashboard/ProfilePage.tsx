import { useEffect, useState, type FormEvent } from "react";
import { useTenant } from "../../dashboard/useTenant";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import { isSafeHref } from "../../lib/urls";
import { LinksEditor } from "./LinksEditor";

type ProfileForm = {
  tagline: string;
  description: string;
  location_label: string;
  logo_url: string;
  is_published: boolean;
};

const empty: ProfileForm = {
  tagline: "",
  description: "",
  location_label: "",
  logo_url: "",
  is_published: false,
};

export function ProfilePage() {
  const { active, loading } = useTenant();
  const [form, setForm] = useState<ProfileForm>(empty);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !active) {
      return;
    }
    void supabase
      .from("business_profiles")
      .select("tagline, description, location_label, logo_url, is_published")
      .eq("business_id", active.business_id)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (queryError) {
          setError(queryError.message);
          return;
        }
        if (!data) {
          return;
        }
        setForm({
          tagline: data.tagline ?? "",
          description: data.description ?? "",
          location_label: data.location_label ?? "",
          logo_url: data.logo_url ?? "",
          is_published: Boolean(data.is_published),
        });
      });
  }, [active]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !active) {
      return;
    }
    if (form.logo_url && !isSafeHref(form.logo_url)) {
      setError("Logo URL must be https://");
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase
      .from("business_profiles")
      .update({
        tagline: form.tagline || null,
        description: form.description || null,
        location_label: form.location_label || null,
        logo_url: form.logo_url || null,
        is_published: form.is_published,
      })
      .eq("business_id", active.business_id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMessage("Profile saved.");
  }

  if (loading) {
    return (
      <main className="page app-page">
        <div className="skeleton-card" role="status">
          <div className="loading-block" />
          <div className="loading-block" />
        </div>
      </main>
    );
  }

  if (!active) {
    return (
      <main className="page app-page">
        <section className="card empty-state">
          <h3>Create a business first</h3>
          <p className="muted">Profile publishing is tied to a business tenant.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="page app-page stack">
      <header className="page-header">
        <p className="eyebrow">Profile</p>
        <h1>Business profile</h1>
        <p className="muted">Publish a polished public page for customers coming from QR/NFC.</p>
        <div className="info-grid">
          <div className="pill">Slug: /t/{active.businesses?.slug}</div>
          <div className={form.is_published ? "pill active" : "pill"}>
            {form.is_published ? "Published" : "Draft"}
          </div>
        </div>
      </header>

      <section className="card stack" aria-label="Profile form">
        <form onSubmit={(event) => void onSubmit(event)} className="stack">
          <div className="grid-two">
            <label>
              Tagline
              <input
                value={form.tagline}
                onChange={(event) => setForm({ ...form, tagline: event.target.value })}
                placeholder="Delightful coffee in Westlands"
              />
            </label>
            <label>
              Location label
              <input
                value={form.location_label}
                onChange={(event) => setForm({ ...form, location_label: event.target.value })}
                placeholder="Nairobi, Kenya"
              />
            </label>
          </div>
          <label>
            Description
            <textarea
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="Tell customers what makes you special"
            />
          </label>
          <div className="grid-two">
            <label>
              Logo URL (https only)
              <input
                value={form.logo_url}
                onChange={(event) => setForm({ ...form, logo_url: event.target.value })}
                placeholder="https://..."
              />
            </label>
            <label className="inline">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(event) => setForm({ ...form, is_published: event.target.checked })}
              />
              Published (required for /t/{active.businesses?.slug} and analytics)
            </label>
          </div>
          {error ? <p className="notice danger">{error}</p> : null}
          {message ? <p className="notice">{message}</p> : null}
          <div className="split">
            <button className="button" type="submit" disabled={saving || active.role === "staff"}>
              {saving ? "Saving…" : "Save profile"}
            </button>
            {active.role === "staff" ? <p className="muted">Staff cannot update profile content.</p> : null}
          </div>
        </form>
      </section>

      <LinksEditor />
    </main>
  );
}
