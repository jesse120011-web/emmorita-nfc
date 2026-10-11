import { useState, type ReactElement, type SVGProps } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";

type NavItem = {
  to: string;
  label: string;
  end?: boolean;
  icon: ReactElement;
};

const iconProps: SVGProps<SVGSVGElement> = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

const icons = {
  overview: (
    <svg {...iconProps}>
      <path d="M4 12 12 4l8 8" />
      <path d="M6 10v10h12V10" />
    </svg>
  ),
  customers: (
    <svg {...iconProps}>
      <path d="M8 13a3 3 0 1 1 0-6 3 3 0 0 1 0 6" />
      <path d="M16 14a3 3 0 1 0 0-6 3 3 0 0 0 0 6" />
      <path d="M3 19c0-2.4 2.4-4 5.2-4H11" />
      <path d="M13 15h1.8c2.8 0 5.2 1.6 5.2 4" />
    </svg>
  ),
  touchpoints: (
    <svg {...iconProps}>
      <circle cx="12" cy="6.5" r="2.4" />
      <circle cx="6.5" cy="17.5" r="2.3" />
      <circle cx="17.5" cy="17.5" r="2.3" />
      <path d="M10.6 8.4 8.2 14.6" />
      <path d="M13.4 8.4 15.8 14.6" />
      <path d="M8.8 17.5h6.4" />
    </svg>
  ),
  analytics: (
    <svg {...iconProps}>
      <path d="M5 19V9" />
      <path d="M12 19V5" />
      <path d="M19 19v-7" />
      <path d="M3 19h18" />
    </svg>
  ),
  reputation: (
    <svg {...iconProps}>
      <path d="m12 3.5 2.5 5 5.5.8-4 3.9.9 5.5L12 16.6 7.1 18.7l.9-5.5-4-3.9 5.5-.8z" />
    </svg>
  ),
  branches: (
    <svg {...iconProps}>
      <path d="M4 9h16" />
      <path d="M4 15h16" />
      <path d="M10 4v16" />
      <path d="M14 4v16" />
    </svg>
  ),
  profile: (
    <svg {...iconProps}>
      <rect x="4" y="5" width="16" height="14" rx="2.2" />
      <path d="M8.5 12h7" />
      <path d="M8.5 15h4.5" />
      <circle cx="9" cy="9" r="1.1" />
    </svg>
  ),
  team: (
    <svg {...iconProps}>
      <path d="M12 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3" />
      <path d="M5 19c0-2.6 2.6-4.2 5.2-4.2H12" />
      <path d="M18 13.2A2.6 2.6 0 1 0 15.2 9" />
      <path d="M14.6 14.5H16c2.1 0 3.9 1.2 3.9 3.5" />
    </svg>
  ),
  settings: (
    <svg {...iconProps}>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M4.9 12.9a7.1 7.1 0 0 1 0-1.8l-1.3-1a.8.8 0 0 1-.2-1.1l1.3-2.2a.8.8 0 0 1 1-.3l1.5.6a7.1 7.1 0 0 1 1.6-.9l.2-1.6a.8.8 0 0 1 .8-.7h2.6a.8.8 0 0 1 .8.7l.2 1.6a7.1 7.1 0 0 1 1.6.9l1.5-.6a.8.8 0 0 1 1 .3l1.3 2.2a.8.8 0 0 1-.2 1.1l-1.3 1a7.1 7.1 0 0 1 0 1.8l1.3 1a.8.8 0 0 1 .2 1.1l-1.3 2.2a.8.8 0 0 1-1 .3l-1.5-.6a7.1 7.1 0 0 1-1.6.9l-.2 1.6a.8.8 0 0 1-.8.7h-2.6a.8.8 0 0 1-.8-.7l-.2-1.6a7.1 7.1 0 0 1-1.6-.9l-1.5.6a.8.8 0 0 1-1-.3L3.4 15a.8.8 0 0 1 .2-1.1Z" />
    </svg>
  ),
};

const links: NavItem[] = [
  { to: "/app", label: "Overview", end: true, icon: icons.overview },
  { to: "/app/customers", label: "Customers", icon: icons.customers },
  { to: "/app/touchpoints", label: "Touchpoints", icon: icons.touchpoints },
  { to: "/app/analytics", label: "Analytics", icon: icons.analytics },
  { to: "/app/reputation", label: "Reputation", icon: icons.reputation },
  { to: "/app/branches", label: "Branches", icon: icons.branches },
  { to: "/app/profile", label: "Profile", icon: icons.profile },
  { to: "/app/team", label: "Team", icon: icons.team },
  { to: "/app/settings", label: "Settings", icon: icons.settings },
];

const toggleIcon = (expanded: boolean) => (
  <svg {...iconProps}>
    {expanded ? (
      <>
        <path d="M15 6 9 12l6 6" />
        <path d="M11 6 5 12l6 6" />
      </>
    ) : (
      <>
        <path d="m9 6 6 6-6 6" />
        <path d="m13 6 6 6-6 6" />
      </>
    )}
  </svg>
);

export function DashboardLayout() {
  const { user, signOut } = useAuth();
  const [navPinned, setNavPinned] = useState(false);
  const [navHover, setNavHover] = useState(false);
  const expanded = navPinned || navHover;

  return (
    <div className={`app-shell ${expanded ? "nav-expanded" : "nav-collapsed"}`}>
      <header className="app-header" role="banner">
        <div className="brand-stack" aria-label="EmmOrita workspace">
          <span className="eyebrow">EmmOrita</span>
          <span className="brand">Business OS</span>
          <span className="muted">QR & NFC customer engagement</span>
        </div>
        <div className="user-chip" aria-live="polite">
          <button
            type="button"
            className="icon-button"
            aria-pressed={navPinned}
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            title={expanded ? "Collapse sidebar" : "Expand sidebar"}
            onClick={() => setNavPinned((value) => !value)}
          >
            {toggleIcon(expanded)}
          </button>
          <span className="pill muted">{user?.email ?? "Signed out"}</span>
          <button className="button secondary" type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <nav
        className="app-subnav"
        aria-label="Dashboard navigation"
        data-expanded={expanded}
        onMouseEnter={() => setNavHover(true)}
        onMouseLeave={() => setNavHover(false)}
        onFocus={() => setNavHover(true)}
        onBlur={() => setNavHover(false)}
      >
        <div className="nav-meta" aria-hidden={!expanded}>
          <span className="nav-meta-label">Workspace</span>

        </div>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            aria-label={link.label}
            title={link.label}
            className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
          >
            <span className="nav-icon" aria-hidden="true">
              {link.icon}
            </span>
            <span className="nav-label">{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="app-main">
        <Outlet />
      </div>
    </div>
  );
}
