import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";

const links = [
  { to: "/app", label: "Overview", end: true },
  { to: "/app/profile", label: "Profile", end: false },
  { to: "/app/nfc", label: "NFC tags", end: false },
  { to: "/app/qr", label: "QR codes", end: false },
  { to: "/app/analytics", label: "Analytics", end: false },
  { to: "/app/team", label: "Team", end: false },
  { to: "/app/settings", label: "Settings", end: false },
];

export function DashboardLayout() {
  const { user, signOut } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="brand">EmmOrita dashboard</span>
        <div>
          <span className="muted">{user?.email}</span>{" "}
          <button type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <nav className="app-subnav" aria-label="Dashboard">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => (isActive ? "active" : "")}>
            {link.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
