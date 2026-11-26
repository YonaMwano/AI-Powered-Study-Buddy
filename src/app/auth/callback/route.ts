import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/studio";
  const pendingUpload = searchParams.get("pendingUpload");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const redirectUrl = new URL(next, origin);
      if (pendingUpload === "1") {
        redirectUrl.searchParams.set("pendingUpload", "1");
      }
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Auth error → back to login
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
