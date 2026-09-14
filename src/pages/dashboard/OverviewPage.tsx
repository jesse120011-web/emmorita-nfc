import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useTenant } from "../../dashboard/useTenant";

export function OverviewPage() {
  const { loading, error, memberships, active, createBusiness, setActiveBusinessId } = useTenant();
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const message = await createBusiness(name);
    setPending(false);
    setFormError(message);
    if (!message) {
      setName("");
    }
  }

  return (
    <main className="page app-page stack">
      <h1>Overview</h1>
      {loading ? <p>Loading businesses…</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {memberships.length > 1 ? (
        <label>
          Active business
          <select
            value={active?.business_id ?? ""}
            onChange={(event) => setActiveBusinessId(event.target.value)}
          >
            {memberships.map((row) => (
              <option key={row.business_id} value={row.business_id}>
                {row.businesses?.name ?? row.business_id} ({row.role})
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {active?.businesses ? (
        <section className="card stack">
          <h2>{active.businesses.name}</h2>
          <p>
            Public URL: <code>/t/{active.businesses.slug}</code>
          </p>
          <p>
            Status: {active.businesses.status}. Your role: {active.role}.
          </p>
          <p className="muted">
            NFC and QR should both encode the public URL. Add{" "}
            <code>?src=nfc</code> or <code>?src=qr</code> to distinguish scans in analytics.
          </p>
          <Link to={`/t/${active.businesses.slug}`}>Preview public path</Link>
        </section>
      ) : null}

      {!loading && memberships.length === 0 ? (
        <section className="card stack">
          <h2>Create your first business</h2>
          <p>This creates a tenant, owner membership, and an unpublished profile.</p>
          <form onSubmit={(event) => void onCreate(event)}>
            <label>
              Business name
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            {formError ? <p className="error">{formError}</p> : null}
            <button className="button" type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create business"}
            </button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
