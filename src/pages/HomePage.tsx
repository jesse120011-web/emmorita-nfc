import { Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { getPublicEnv } from "../lib/env";

export function HomePage() {
  const env = getPublicEnv();

  return (
    <>
      <SiteHeader />
      <main className="page stack">
        <section className="hero">
          <p className="muted">EmmOrita Digital Intelligence</p>
          <h1>NFC and QR business profiles for Kenya, built to scale.</h1>
          <p>
            Each business gets a mobile-first public page at <code>/t/business-slug</code>.
            NFC tags and QR codes both open that URL in the browser. No custom customer app.
          </p>
        </section>

        <section className="card stack">
          <h2>Customer actions</h2>
          <p>
            Call, WhatsApp, website, maps, booking, Instagram, Facebook, TikTok, and other
            links the business enables.
          </p>
          <p className="muted">
            Public example path: <code>/t/demo-cafe</code> after a business is published.
          </p>
          <div className="cta-list">
            <Link className="cta" to="/login">
              Business login
            </Link>
            <Link className="button secondary" to="/app">
              Open dashboard
            </Link>
          </div>
        </section>

        {!env.configured ? (
          <section className="card">
            <h2>Local setup required</h2>
            <p>
              Copy <code>.env.example</code> to <code>.env</code> and add your Supabase project
              URL and anon key. Restart the dev server. Never add a service-role key to{" "}
              <code>VITE_</code> variables.
            </p>
          </section>
        ) : null}
      </main>
    </>
  );
}
