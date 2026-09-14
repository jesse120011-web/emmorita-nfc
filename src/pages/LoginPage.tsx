import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/useAuth";
import { SiteHeader } from "../components/SiteHeader";

export function LoginPage() {
  const { configured, user, signIn, signUp } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/app";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  if (!configured) {
    return <Navigate to="/" replace />;
  }

  if (user) {
    return <Navigate to={from} replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);
    const action = mode === "signin" ? signIn : signUp;
    const message = await action(email.trim(), password);
    setPending(false);
    if (message) {
      setError(message);
      return;
    }
    if (mode === "signup") {
      setNotice("Check email confirmation settings in Supabase Auth if you are not signed in yet.");
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="page">
        <section className="card stack">
          <h1>{mode === "signin" ? "Business login" : "Create account"}</h1>
          <p className="muted">
            Owners and staff use the same sign-in. Tenant access is granted through business
            membership rows, not by picking a role in the browser.
          </p>
          <form onSubmit={(event) => void onSubmit(event)}>
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error ? <p className="error">{error}</p> : null}
            {notice ? <p>{notice}</p> : null}
            <button className="button" type="submit" disabled={pending}>
              {pending ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
          <button
            className="button secondary"
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "Need an account?" : "Have an account?"}
          </button>
          <Link to="/">Back to home</Link>
        </section>
      </main>
    </>
  );
}
