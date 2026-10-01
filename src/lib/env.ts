export type PublicEnv = {
  configured: boolean;
  appUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export type PublicEnvErrorCode = "forbidden_service_role_exposure";

export class PublicEnvError extends Error {
  readonly code: PublicEnvErrorCode;

  constructor(code: PublicEnvErrorCode) {
    super("Invalid public configuration.");
    this.name = "PublicEnvError";
    this.code = code;
  }
}

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
    throw new PublicEnvError("forbidden_service_role_exposure");
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
