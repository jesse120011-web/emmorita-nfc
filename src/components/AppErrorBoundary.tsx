import { Component, Fragment, useEffect, useRef, type ReactNode } from "react";
import { PublicEnvError } from "../lib/env";

type BoundaryState = {
  error: Error | null;
  retryToken: number;
};

function getSafeErrorMessage(error: Error): string {
  if (error instanceof PublicEnvError) {
    if (error.code === "forbidden_service_role_exposure") {
      return "Public environment settings are invalid. Remove any service-role key from client-side VITE variables and restart the app.";
    }
  }

  return "A recoverable application error occurred while loading this page.";
}

function FatalErrorScreen({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="page">
      <section className="card stack" role="alert" aria-live="assertive">
        <h1 ref={headingRef} tabIndex={-1}>
          We hit an application error
        </h1>
        <p>{message}</p>
        <p className="muted">
          Try <strong>Try again</strong> to re-render the interface. Use <strong>Reload page</strong>{" "}
          to restart the full application in your browser.
        </p>
        <div className="cta-list">
          <button className="button" type="button" onClick={onRetry}>
            Try again
          </button>
          <button className="button secondary" type="button" onClick={() => window.location.reload()}>
            Reload page
          </button>
          <a href="/">Back to home</a>
        </div>
      </section>
    </main>
  );
}

class AppErrorBoundaryImpl extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = {
    error: null,
    retryToken: 0,
  };

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error };
  }

  handleRetry = () => {
    this.setState((current) => ({
      error: null,
      retryToken: current.retryToken + 1,
    }));
  };

  render() {
    const { error, retryToken } = this.state;
    if (error) {
      return <FatalErrorScreen message={getSafeErrorMessage(error)} onRetry={this.handleRetry} />;
    }

    return <Fragment key={retryToken}>{this.props.children}</Fragment>;
  }
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return <AppErrorBoundaryImpl>{children}</AppErrorBoundaryImpl>;
}
