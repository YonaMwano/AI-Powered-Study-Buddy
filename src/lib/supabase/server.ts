import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AUTH_COOKIE_OPTIONS } from "./cookie-options";

/**
 * Server Supabase client — publishable (anon) key + session cookies only.
 * Cookies use long maxAge so users stay logged in across visits.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        path: AUTH_COOKIE_OPTIONS.path,
        sameSite: AUTH_COOKIE_OPTIONS.sameSite,
        maxAge: AUTH_COOKIE_OPTIONS.maxAge,
        secure: AUTH_COOKIE_OPTIONS.secure,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...AUTH_COOKIE_OPTIONS,
                ...options,
              })
            );
          } catch {
            // Server Component context — middleware will refresh cookies
          }
        },
      },
    }
  );
}
