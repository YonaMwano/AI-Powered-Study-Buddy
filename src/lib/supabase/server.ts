import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Parameters<typeof cookieStore.set>[2];
          }[]
        ) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — safe to ignore
          }
        },
      },
    }
  );
}

/**
 * Service-role client. Bypasses RLS.
 * Required for guest writes and reliable server inserts.
 * Falls back to anon only if service key is missing (will fail RLS for user rows).
 */
export async function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  // New Supabase dashboard: "Secret key" (sb_secret_...)
  // Legacy dashboard: "service_role" JWT (eyJ...)
  const key =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "[supabase] SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) is not set — inserts may fail under RLS."
    );
  }

  return createSupabaseJsClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
