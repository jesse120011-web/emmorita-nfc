import { useEffect, useState, type FormEvent } from "react";
import { useTenant } from "../../dashboard/TenantProvider";
import { getSupabaseBrowserClient } from "../../lib/supabase";
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
      .then(({ data }) => {
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
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !active) {
      return;
    }
    setSaving(true);
    const { error } = await supabase
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
    setMessage(error ? error.message : "Profile saved.");
  }

  if (loading) {
    return (
      <main className="page app-page">
        <p>Loading…</p>
      </main>
    );
  }

  if (!active) {
    return (
      <main className="page app-page">
        <p>Create a business first.</p>
      </main>
    );
  }

  return (
    <main className="page app-page stack">
      <section className="card">
        <h1>Business profile</h1>
        <form onSubmit={(event) => void onSubmit(event)}>
          <label>
            Tagline
            <input
              value={form.tagline}
              onChange={(event) => setForm({ ...form, tagline: event.target.value })}
            />
          </label>
          <label>
            Description
            <input
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>
          <label>
            Location label
            <input
              value={form.location_label}
              onChange={(event) => setForm({ ...form, location_label: event.target.value })}
            />
          </label>
          <label>
            Logo URL
            <input
              value={form.logo_url}
              onChange={(event) => setForm({ ...form, logo_url: event.target.value })}
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(event) => setForm({ ...form, is_published: event.target.checked })}
            />{" "}
            Published (required for /t/{active.businesses?.slug} and public analytics)
          </label>
          <button className="button" type="submit" disabled={saving || active.role === "staff"}>
            Save profile
          </button>
          {message ? <p>{message}</p> : null}
        </form>
      </section>
      <LinksEditor />
    </main>
  );
}
