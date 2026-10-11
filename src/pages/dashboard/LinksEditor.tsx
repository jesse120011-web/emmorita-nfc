import { useEffect, useState, type FormEvent } from "react";
import { useTenant } from "../../dashboard/useTenant";
import { getSupabaseBrowserClient } from "../../lib/supabase";
import { isSafeHref } from "../../lib/urls";
import type { LinkKind, PublicLink } from "../../lib/types";

const kinds: LinkKind[] = [
  "phone",
  "whatsapp",
  "website",
  "maps",
  "booking",
  "instagram",
  "facebook",
  "tiktok",
  "email",
  "custom",
];

export function LinksEditor() {
  const { active } = useTenant();
  const [links, setLinks] = useState<PublicLink[]>([]);
  const [kind, setKind] = useState<LinkKind>("whatsapp");
  const [label, setLabel] = useState("WhatsApp");
  const [href, setHref] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !active) {
      return;
    }
    void supabase
      .from("business_links")
      .select("id, business_id, kind, label, href, sort_order")
      .eq("business_id", active.business_id)
      .is("deleted_at", null)
      .order("sort_order")
      .then(({ data }) => setLinks((data as PublicLink[] | null) ?? []));
  }, [active]);

  if (!active) {
    return null;
  }

  const businessId = active.business_id;
  const role = active.role;

  async function onAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      return;
    }
    const sanitizedHref = href.trim();
    if (!isSafeHref(sanitizedHref)) {
      setError("Use https://, mailto:, tel:, sms:, or WhatsApp links.");
      return;
    }
    const { error: insertError, data } = await supabase
      .from("business_links")
      .insert({
        business_id: businessId,
        kind,
        label,
        href: sanitizedHref,
        sort_order: links.length,
      })
      .select("id, business_id, kind, label, href, sort_order")
      .single();
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setLinks((current) => [...current, data as PublicLink]);
    setHref("");
    setError(null);
  }

  return (
    <section className="card stack" aria-label="Public actions">
      <div className="section-header">
        <div>
          <p className="eyebrow">Actions</p>
          <h2>Public actions</h2>
          <p className="muted">These appear on your public profile in order.</p>
        </div>
      </div>
      <ul className="list">
        {links.map((link) => (
          <li key={link.id} className="list-row">
            <span>{link.label}</span>
            <span className="badge">{link.kind}</span>
          </li>
        ))}
      </ul>
      {links.length === 0 ? <p className="muted">No public actions yet.</p> : null}
      {role === "staff" ? (
        <p className="muted">Staff can view links. Owners and admins can add them.</p>
      ) : (
        <form onSubmit={(event) => void onAdd(event)} className="stack" aria-label="Add public action">
          <div className="grid-two">
            <label>
              Type
              <select value={kind} onChange={(event) => setKind(event.target.value as LinkKind)}>
                {kinds.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Label
              <input value={label} onChange={(event) => setLabel(event.target.value)} required />
            </label>
          </div>
          <label>
            Href (https://, tel:, mailto:, or wa.me)
            <input value={href} onChange={(event) => setHref(event.target.value)} required />
          </label>
          {error ? <p className="notice danger">{error}</p> : null}
          <button className="button" type="submit">
            Add action
          </button>
        </form>
      )}
    </section>
  );
}
