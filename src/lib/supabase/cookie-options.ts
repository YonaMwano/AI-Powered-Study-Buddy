/** Shared cookie options so auth sessions survive browser restarts */
export const AUTH_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  // 400 days — browsers cap persistent cookies around this
  maxAge: 60 * 60 * 24 * 400,
  // Secure cookies only on HTTPS (production / Vercel)
  get secure() {
    return process.env.NODE_ENV === "production";
  },
};
