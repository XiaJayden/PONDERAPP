export const DASH_COOKIE_NAME = "PONDER_dash";

export function getDashboardPassword(): string {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) throw new Error("Missing DASHBOARD_PASSWORD env var");
  return pw;
}

export function expectedCookieValue(): string {
  // Keep this Edge-safe (no Node crypto). For a dev-only dashboard, storing the password
  // as an httpOnly cookie is acceptable.
  return getDashboardPassword();
}


