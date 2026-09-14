import { Link } from "react-router-dom";

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link to="/" className="brand">
        EmmOrita NFC
      </Link>
      <nav className="site-nav" aria-label="Primary">
        <Link to="/login">Business login</Link>
        <Link to="/app">Dashboard</Link>
      </nav>
    </header>
  );
}
