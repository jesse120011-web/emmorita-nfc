export type PublicEnv = {
  configured: boolean;
  appUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

function read(name: "VITE_PUBLIC_APP_URL" | "VITE_SUPABASE_URL" | "VITE_SUPABASE_ANON_KEY"): string {
  const value = import.meta.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function isPlaceholder(value: string): boolean {
  return (
    value.length === 0 ||
    value.includes("your-project-ref") ||
    value.includes("your-anon-key")
  );
}

export function getPublicEnv(): PublicEnv {
  if (import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY must never be exposed to the browser. Remove any VITE_ service-role variable.",
    );
  }

  const supabaseUrl = read("VITE_SUPABASE_URL");
  const supabaseAnonKey = read("VITE_SUPABASE_ANON_KEY");
  const appUrl = read("VITE_PUBLIC_APP_URL") || window.location.origin;

  return {
    configured: !isPlaceholder(supabaseUrl) && !isPlaceholder(supabaseAnonKey),
    appUrl,
    supabaseUrl,
    supabaseAnonKey,
  };
}
