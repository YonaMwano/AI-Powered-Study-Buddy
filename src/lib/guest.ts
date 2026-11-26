import { createServiceClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

const GUEST_COOKIE = "guest_id";
const GUEST_MAX_GENERATIONS = 1;
const GUEST_WINDOW_HOURS = 24;

export async function getOrCreateGuestId(): Promise<string> {
  const cookieStore = await cookies();
  let guestId = cookieStore.get(GUEST_COOKIE)?.value;

  if (!guestId) {
    guestId = `guest_${crypto.randomUUID()}`;
    cookieStore.set(GUEST_COOKIE, guestId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });
  }

  return guestId;
}

export async function checkGuestQuota(guestId: string): Promise<{
  allowed: boolean;
  remaining: number;
  message?: string;
}> {
  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("guest_usage")
      .select("generation_count, last_generation_at")
      .eq("guest_id", guestId)
      .maybeSingle();

    if (error) {
      console.error("guest_usage select error", error);
      // Fail open for availability, but log
      return { allowed: true, remaining: GUEST_MAX_GENERATIONS };
    }

    if (!data) {
      return { allowed: true, remaining: GUEST_MAX_GENERATIONS };
    }

    const last = data.last_generation_at
      ? new Date(data.last_generation_at)
      : null;
    const windowMs = GUEST_WINDOW_HOURS * 60 * 60 * 1000;
    const inWindow = last && Date.now() - last.getTime() < windowMs;

    if (inWindow && data.generation_count >= GUEST_MAX_GENERATIONS) {
      return {
        allowed: false,
        remaining: 0,
        message:
          "Guest limit reached (1 free generation per 24h). Sign in for unlimited studies.",
      };
    }

    // Window expired → reset conceptually
    if (!inWindow) {
      return { allowed: true, remaining: GUEST_MAX_GENERATIONS };
    }

    return {
      allowed: true,
      remaining: Math.max(0, GUEST_MAX_GENERATIONS - data.generation_count),
    };
  } catch (e) {
    console.error("checkGuestQuota", e);
    return { allowed: true, remaining: GUEST_MAX_GENERATIONS };
  }
}

export async function incrementGuestUsage(guestId: string): Promise<void> {
  try {
    const supabase = await createServiceClient();
    const { data } = await supabase
      .from("guest_usage")
      .select("generation_count, last_generation_at")
      .eq("guest_id", guestId)
      .maybeSingle();

    const last = data?.last_generation_at
      ? new Date(data.last_generation_at)
      : null;
    const windowMs = GUEST_WINDOW_HOURS * 60 * 60 * 1000;
    const inWindow = last && Date.now() - last.getTime() < windowMs;

    const newCount =
      inWindow && data ? data.generation_count + 1 : 1;

    await supabase.from("guest_usage").upsert(
      {
        guest_id: guestId,
        generation_count: newCount,
        last_generation_at: new Date().toISOString(),
      },
      { onConflict: "guest_id" }
    );
  } catch (e) {
    console.error("incrementGuestUsage", e);
  }
}
