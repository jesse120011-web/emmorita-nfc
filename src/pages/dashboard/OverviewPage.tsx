import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import { useTenant } from "../../dashboard/useTenant";

export function OverviewPage() {
  const { user } = useAuth();
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

  const onboarding = useMemo(() => {
    const hasBusiness = Boolean(active?.business_id);
    const hasProfile = Boolean(active?.businesses && active.businesses.slug);
    const isPublished = Boolean(active?.businesses && active.businesses.status === "active");
    return [
      {
        title: "Account",
        done: Boolean(user?.email),
        detail: user?.email ?? "Sign in required",
        cta: user ? null : "/login",
      },
      {
        title: "Business",
        done: hasBusiness,
        detail: hasBusiness ? active?.businesses?.name ?? "" : "Create a business tenant",
        cta: hasBusiness ? null : null,
      },
      {
        title: "Profile",
        done: hasProfile,
        detail: hasProfile ? `Slug /t/${active?.businesses?.slug}` : "Add profile details",
        cta: hasBusiness ? "/app/profile" : null,
      },
      {
        title: "Publish",
        done: isPublished,
        detail: isPublished ? "Live" : "Set status to active",
        cta: hasBusiness ? "/app/settings" : null,
      },
      {
        title: "Touchpoint",
        done: false,
        detail: "Register QR/NFC and assign branch",
        cta: hasBusiness ? "/app/touchpoints" : null,
      },
      {
        title: "Verify",
        done: false,
        detail: "Scan your public link to confirm",
        cta: hasBusiness && hasProfile ? `/t/${active?.businesses?.slug}` : null,
      },
    ];
  }, [active, user]);

  return (
    <main className="page app-page stack">
      <header className="page-header">
        <p className="eyebrow">Overview</p>
        <h1>Workspace overview</h1>
        <p className="muted">Guide: account ? business ? profile ? publish ? touchpoint ? verify.</p>
      </header>

      {loading ? (
        <section className="card-grid" aria-label="Loading businesses">
          {[...Array(2)].map((_, index) => (
            <div key={index} className="skeleton-card" role="status" aria-live="polite">
              <div className="loading-block" />
              <div className="loading-block" />
              <div className="loading-block" />
            </div>
          ))}
        </section>
      ) : null}

      {error ? (
        <section className="notice danger" role="alert">
          {error}
        </section>
      ) : null}

      <section className="card stack" aria-label="Guided onboarding">
        <div className="section-header">
          <div>
            <p className="eyebrow">Onboarding</p>
            <h2>Complete the setup loop</h2>
            <p className="muted">Move from sign-in to a verified touchpoint with clear steps.</p>
          </div>
        </div>
        <div className="checklist">
          {onboarding.map((item) => (
            <div key={item.title} className={item.done ? "checklist-row done" : "checklist-row"}>
              <div className="check-icon" aria-hidden="true">{item.done ? "?" : "?"}</div>
              <div className="stack" style={{ gap: "0.1rem" }}>
                <strong>{item.title}</strong>
                <span className="muted">{item.detail}</span>
              </div>
              {item.cta ? (
                <Link className="button ghost" to={item.cta} aria-label={`${item.title} step`}>
                  Go
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {memberships.length > 1 ? (
        <section className="card stack" aria-label="Active business selector">
          <div className="section-header">
            <h2>Active business</h2>
            <p className="muted">Switch which business the dashboard controls.</p>
          </div>
          <label>
            Business
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
        </section>
      ) : null}

      {active?.businesses ? (
        <section className="card-grid">
          <section className="card stack" aria-label="Business summary">
            <div className="section-header">
              <div>
                <p className="eyebrow">Active</p>
                <h2>{active.businesses.name}</h2>
              </div>
              <div className="info-grid">
                <span className="pill">Slug: /t/{active.businesses.slug}</span>
                <span className="pill active">Status: {active.businesses.status}</span>
                <span className="pill">Role: {active.role}</span>
              </div>
            </div>
            <p className="muted">
              Publish the profile and keep QR/NFC pointing to the same URL with <code>?src=qr</code> or
              <code>?src=nfc</code> for attribution.
            </p>
            <div className="split">
              <Link className="button secondary" to={`/t/${active.businesses.slug}`}>
                Preview public page
              </Link>
              <span className="meta">Status changes live in Settings.</span>
            </div>
          </section>

          <section className="card stack" aria-label="Next steps">
            <div className="section-header">
              <h3>Next steps</h3>
              <p className="muted">Polish, publish, and monitor performance.</p>
            </div>
            <ul className="list">
              <li className="list-row">
                <span>Publish business profile</span>
                <span className="badge">Profile</span>
              </li>
              <li className="list-row">
                <span>Add QR touchpoints and assign branches</span>
                <span className="badge">Touchpoints</span>
              </li>
              <li className="list-row">
                <span>Connect WhatsApp / calls / web links</span>
                <span className="badge">Actions</span>
              </li>
              <li className="list-row">
                <span>Review analytics for scans and taps</span>
                <span className="badge">Analytics</span>
              </li>
            </ul>
          </section>
        </section>
      ) : null}

      {!loading && memberships.length === 0 ? (
        <section className="card stack empty-state" aria-label="Create first business">
          <h2>Create your first business</h2>
          <p className="muted">
            This creates a tenant, owner membership, and an unpublished profile. Publish and add QR/NFC when ready.
          </p>
          <form onSubmit={(event) => void onCreate(event)} className="stack">
            <label>
              Business name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Kijani Coffee"
                required
              />
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
