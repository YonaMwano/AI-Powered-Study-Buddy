import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * OAuth / magic-link callback.
 * Exchanges `code` for a session and writes auth cookies onto the redirect response.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/studio";
  if (!next.startsWith("/")) next = "/studio";
  const pendingUpload = searchParams.get("pendingUpload");

  if (code) {
    const redirectUrl = new URL(next, origin);
    if (pendingUpload === "1") {
      redirectUrl.searchParams.set("pendingUpload", "1");
    }

    const response = NextResponse.redirect(redirectUrl);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value);
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    }
    console.error("auth callback exchange error", error.message);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
