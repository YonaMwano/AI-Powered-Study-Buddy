import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { AUTH_COOKIE_OPTIONS } from "@/lib/supabase/cookie-options";

/**
 * OAuth / magic-link callback.
 * Exchanges the auth code for a session and writes long-lived cookies
 * onto the redirect response so the user stays signed in.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next =
    searchParams.get("next") ||
    (searchParams.get("pendingUpload") === "1" ? "/studio?pendingUpload=1" : "/studio");

  const safeNext = next.startsWith("/") ? next : "/studio";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  // Build redirect first so we can attach cookies to it
  const response = NextResponse.redirect(
    `${origin}${safeNext}${safeNext.includes("?") ? "&" : "?"}auth=success`
  );

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        path: AUTH_COOKIE_OPTIONS.path,
        sameSite: AUTH_COOKIE_OPTIONS.sameSite,
        maxAge: AUTH_COOKIE_OPTIONS.maxAge,
        secure: origin.startsWith("https"),
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
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              path: "/",
              sameSite: "lax",
              maxAge: AUTH_COOKIE_OPTIONS.maxAge,
              secure: origin.startsWith("https"),
              httpOnly: options?.httpOnly as boolean | undefined,
              ...(options || {}),
            });
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("auth callback error", error.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  // Ensure profile exists (backfill if trigger missed)
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").upsert(
        {
          id: user.id,
          display_name:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split("@")[0] ||
            "User",
          avatar_url: user.user_metadata?.avatar_url || null,
        },
        { onConflict: "id" }
      );
    }
  } catch (profileErr) {
    console.warn("profile upsert skipped", profileErr);
  }

  return response;
}
