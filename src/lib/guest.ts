import { cookies } from "next/headers";

const GUEST_COOKIE = "guest_id";
const GUEST_QUOTA_COOKIE = "guest_quota";
const GUEST_MAX_GENERATIONS = 1;
const GUEST_WINDOW_HOURS = 24;

/** Cookie-only guest identity — no DB / secret key required */
export async function getOrCreateGuestId(): Promise<string> {
  const cookieStore = await cookies();
  let guestId = cookieStore.get(GUEST_COOKIE)?.value;

  if (!guestId) {
    guestId = `guest_${crypto.randomUUID()}`;
    try {
      cookieStore.set(GUEST_COOKIE, guestId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
    } catch {
      // ignore if cookies locked in RSC
    }
  }

  return guestId;
}

type QuotaPayload = { count: number; at: number };

function parseQuota(raw: string | undefined): QuotaPayload | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as QuotaPayload;
    if (typeof p.count === "number" && typeof p.at === "number") return p;
  } catch {
    /* ignore */
  }
  return null;
}

/** Guest quota stored in httpOnly cookie (no guest_usage table / secret key) */
export async function checkGuestQuota(guestId: string): Promise<{
  allowed: boolean;
  remaining: number;
  message?: string;
}> {
  void guestId;
  try {
    const cookieStore = await cookies();
    const data = parseQuota(cookieStore.get(GUEST_QUOTA_COOKIE)?.value);
    if (!data) {
      return { allowed: true, remaining: GUEST_MAX_GENERATIONS };
    }

    const windowMs = GUEST_WINDOW_HOURS * 60 * 60 * 1000;
    const inWindow = Date.now() - data.at < windowMs;

    if (inWindow && data.count >= GUEST_MAX_GENERATIONS) {
      return {
        allowed: false,
        remaining: 0,
        message:
          "Guest limit reached (1 free generation per 24h). Sign in for unlimited studies.",
      };
    }

    if (!inWindow) {
      return { allowed: true, remaining: GUEST_MAX_GENERATIONS };
    }

    return {
      allowed: true,
      remaining: Math.max(0, GUEST_MAX_GENERATIONS - data.count),
    };
  } catch {
    return { allowed: true, remaining: GUEST_MAX_GENERATIONS };
  }
}

export async function incrementGuestUsage(guestId: string): Promise<void> {
  void guestId;
  try {
    const cookieStore = await cookies();
    const data = parseQuota(cookieStore.get(GUEST_QUOTA_COOKIE)?.value);
    const windowMs = GUEST_WINDOW_HOURS * 60 * 60 * 1000;
    const inWindow = data && Date.now() - data.at < windowMs;
    const newCount = inWindow && data ? data.count + 1 : 1;

    cookieStore.set(
      GUEST_QUOTA_COOKIE,
      JSON.stringify({ count: newCount, at: Date.now() }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 2,
        path: "/",
      }
    );
  } catch (e) {
    console.error("incrementGuestUsage", e);
  }
}
