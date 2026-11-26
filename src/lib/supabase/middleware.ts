import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_OPTIONS } from "./cookie-options";

/**
 * Refresh Supabase auth session on every matched request and
 * write updated cookies onto the response so the user stays logged in.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        path: AUTH_COOKIE_OPTIONS.path,
        sameSite: AUTH_COOKIE_OPTIONS.sameSite,
        maxAge: AUTH_COOKIE_OPTIONS.maxAge,
        secure:
          request.nextUrl.protocol === "https:" || AUTH_COOKIE_OPTIONS.secure,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, {
              path: "/",
              sameSite: "lax",
              maxAge: AUTH_COOKIE_OPTIONS.maxAge,
              secure:
                request.nextUrl.protocol === "https:" ||
                AUTH_COOKIE_OPTIONS.secure,
              ...(options || {}),
            });
          });
        },
      },
    }
  );

  // IMPORTANT: refreshes the session if expired and writes new cookies
  await supabase.auth.getUser();

  return supabaseResponse;
}
