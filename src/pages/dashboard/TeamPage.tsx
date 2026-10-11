import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/useAuth";
import { useTenant } from "../../dashboard/useTenant";
import { getSupabaseBrowserClient } from "../../lib/supabase";

type MemberRow = { id: string; role: "owner" | "admin" | "staff"; user_id: string; business_id: string };

const roleLabels: Record<MemberRow["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
};

const roleOptions: MemberRow["role"][] = ["owner", "admin", "staff"];

export function TeamPage() {
  const { user } = useAuth();
  const { active, loading } = useTenant();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const canManage = useMemo(() => active && (active.role === "owner" || active.role === "admin"), [active]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !active) {
      setMembers([]);
      return;
    }
    setError(null);
    supabase
      .from("business_members")
      .select("id, role, user_id, business_id")
      .eq("business_id", active.business_id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .then(({ data, error: queryError }) => {
        if (queryError) {
          setError(queryError.message);
          return;
        }
        setMembers((data as MemberRow[] | null) ?? []);
      });
  }, [active]);

  async function updateRole(member: MemberRow, role: MemberRow["role"]) {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !active || !canManage) return;
    if (member.role === role) return;
    setPendingId(member.id);
    setMessage(null);
    setError(null);
    const { error: updateError, data } = await supabase
      .from("business_members")
      .update({ role })
      .eq("id", member.id)
      .eq("business_id", active.business_id)
      .select("id, role, user_id, business_id")
      .maybeSingle();
    setPendingId(null);
    if (updateError || !data) {
      setError(updateError?.message ?? "Unable to update role");
      return;
    }
    setMembers((rows) => rows.map((row) => (row.id === member.id ? (data as MemberRow) : row)));
    setMessage("Role updated");
  }

  return (
    <main className="page app-page stack">
      <header className="page-header">
        <p className="eyebrow">Team</p>
        <h1>Access & roles</h1>
        <p className="muted">Owners and admins manage access. Staff have limited permissions.</p>
      </header>

      {loading ? (
        <section className="card skeleton-card" aria-label="Loading team">
          <div className="loading-block" />
          <div className="loading-block" />
        </section>
      ) : null}

      {!active ? (
        <section className="card stack empty-state" role="status">
          <h3>Choose a business</h3>
          <p className="muted">Team access is scoped to each business. Select one in Overview.</p>
        </section>
      ) : (
        <section className="card stack" aria-label="Team list">
          <div className="section-header">
            <h2>Members</h2>
            <p className="muted">Update roles directly. Owners remain protected.</p>
          </div>
          {error ? <p className="notice danger">{error}</p> : null}
          {message ? <p className="notice success">{message}</p> : null}
          <ul className="list">
            {members.map((member) => {
              const isSelf = member.user_id === user?.id;
              const locked = member.role === "owner" || !canManage;
              return (
                <li key={member.id} className="list-row">
                  <span>{member.user_id}</span>
                  <select
                    value={member.role}
                    aria-label={`Role for ${member.user_id}`}
                    onChange={(e) => void updateRole(member, e.target.value as MemberRow["role"])}
                    disabled={locked || pendingId === member.id || isSelf}
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {roleLabels[role]}
                      </option>
                    ))}
                  </select>
                  {pendingId === member.id ? <span className="meta">Updating…</span> : null}
                  {locked || isSelf ? <span className="meta">{roleLabels[member.role]}</span> : null}
                </li>
              );
            })}
          </ul>
          {members.length === 0 ? <p className="muted">No team members yet.</p> : null}
        </section>
      )}
    </main>
  );
}
