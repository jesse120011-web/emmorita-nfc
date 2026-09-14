import { useEffect, useState } from "react";
import { useTenant } from "../../dashboard/useTenant";
import { getSupabaseBrowserClient } from "../../lib/supabase";

type MemberRow = { id: string; role: string; user_id: string };

export function TeamPage() {
  const { active, loading } = useTenant();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !active) {
      return;
    }
    void supabase
      .from("business_members")
      .select("id, role, user_id")
      .eq("business_id", active.business_id)
      .is("deleted_at", null)
      .then(({ data, error: queryError }) => {
        if (queryError) {
          setError(queryError.message);
          return;
        }
        setMembers((data as MemberRow[] | null) ?? []);
      });
  }, [active]);

  return (
    <main className="page app-page stack">
      <h1>Team</h1>
      {loading ? <p>Loading…</p> : null}
      {!active ? <p>Create a business first.</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {active ? (
        <section className="card stack">
          <p>Roles: owner, admin, staff. Invites are not implemented in this foundation.</p>
          <ul>
            {members.map((member) => (
              <li key={member.id}>
                {member.role} — {member.user_id}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
