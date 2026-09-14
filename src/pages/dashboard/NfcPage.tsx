import { useTenant } from "../../dashboard/useTenant";

export function NfcPage() {
  const { active, loading } = useTenant();

  return (
    <main className="page app-page stack">
      <h1>NFC tags</h1>
      {loading ? <p>Loading…</p> : null}
      {!active ? <p>Create a business first.</p> : null}
      {active ? (
        <section className="card stack">
          <p>
            Encode this URL on the tag. The phone browser opens the profile. No customer app.
          </p>
          <p>
            <code>
              {window.location.origin}/t/{active.businesses?.slug}?src=nfc
            </code>
          </p>
          <p className="muted">
            Tag inventory, assignment, activation, deactivation, and replacement are modeled in{" "}
            <code>nfc_tags</code>. Creating unassigned hardware records is a platform-admin
            operation so businesses cannot mint inventory they do not own.
          </p>
        </section>
      ) : null}
    </main>
  );
}
