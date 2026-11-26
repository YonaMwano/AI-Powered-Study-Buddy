import { createBrowserClient } from "@supabase/ssr";
import { AUTH_COOKIE_OPTIONS } from "./cookie-options";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        path: AUTH_COOKIE_OPTIONS.path,
        sameSite: AUTH_COOKIE_OPTIONS.sameSite,
        maxAge: AUTH_COOKIE_OPTIONS.maxAge,
        secure: typeof window !== "undefined"
          ? window.location.protocol === "https:"
          : AUTH_COOKIE_OPTIONS.secure,
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    }
  );
}
