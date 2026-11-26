import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * OAuth / magic-link callback.
 * One-shot: exchange code → write session cookies → redirect into the app logged in.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const { searchParams, origin } = url;
  const code = searchParams.get("code");
  let next = searchParams.get("next") ?? "/studio";
  if (!next.startsWith("/")) next = "/studio";
  const pendingUpload = searchParams.get("pendingUpload");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const redirectUrl = new URL(next, origin);
  if (pendingUpload === "1") {
    redirectUrl.searchParams.set("pendingUpload", "1");
  }
  redirectUrl.searchParams.set("auth", "success");

  const response = NextResponse.redirect(redirectUrl);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Parameters<typeof response.cookies.set>[2];
          }[]
        ) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const opts = {
              ...options,
              path: options?.path ?? "/",
              sameSite:
                (options?.sameSite as "lax" | "strict" | "none") ?? "lax",
              secure:
                process.env.NODE_ENV === "production"
                  ? true
                  : options?.secure,
            };
            request.cookies.set(name, value);
            response.cookies.set(name, value, opts);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("auth callback exchange error", error.message);
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  return response;
}
