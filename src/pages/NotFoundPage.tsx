import { SiteHeader } from "../components/SiteHeader";

export function NotFoundPage() {
  return (
    <>
      <SiteHeader />
      <main className="page">
        <section className="card">
          <h1>Page not found</h1>
          <p>The path does not match a public profile or dashboard route.</p>
        </section>
      </main>
    </>
  );
}
