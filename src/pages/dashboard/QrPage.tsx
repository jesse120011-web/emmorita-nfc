import { useEffect, useState } from "react";
import { useTenant } from "../../dashboard/useTenant";
import { getSupabaseBrowserClient } from "../../lib/supabase";

type QrRow = { id: string; label: string | null; status: string };

export function QrPage() {
  const { active, loading } = useTenant();
  const [rows, setRows] = useState<QrRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !active) {
      return;
    }
    void supabase
      .from("qr_codes")
      .select("id, label, status")
      .eq("business_id", active.business_id)
      .is("deleted_at", null)
      .then(({ data, error: queryError }) => {
        if (queryError) {
          setError(queryError.message);
          return;
        }
        setRows((data as QrRow[] | null) ?? []);
      });
  }, [active]);

  async function addCode() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !active) {
      return;
    }
    const { data, error: insertError } = await supabase
      .from("qr_codes")
      .insert({
        business_id: active.business_id,
        label: `QR ${rows.length + 1}`,
        status: "active",
      })
      .select("id, label, status")
      .single();
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setRows((current) => [...current, data as QrRow]);
  }

  return (
    <main className="page app-page stack">
      <h1>QR codes</h1>
      {loading ? <p>Loading…</p> : null}
      {!active ? <p>Create a business first.</p> : null}
      {active ? (
        <section className="card stack">
          <p>
            Print or display a QR that opens the same profile as NFC:
          </p>
          <p>
            <code>
              {window.location.origin}/t/{active.businesses?.slug}?src=qr
            </code>
          </p>
          <ul>
            {rows.map((row) => (
              <li key={row.id}>
                {row.label} ({row.status})
              </li>
            ))}
          </ul>
          {error ? <p className="error">{error}</p> : null}
          <button className="button" type="button" onClick={() => void addCode()} disabled={active.role === "staff"}>
            Register QR asset
          </button>
        </section>
      ) : null}
    </main>
  );
}
