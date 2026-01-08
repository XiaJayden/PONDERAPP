import { NextResponse, type NextRequest } from "next/server";
import { DASH_COOKIE_NAME, expectedCookieValue, getDashboardPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // Avoid relying on FormData typing in the route handler build pipeline.
  const params = new URLSearchParams(await req.text());
  const password = params.get("password") ?? "";
  const next = params.get("next") ?? "/dashboard";

  if (!password || password !== getDashboardPassword()) {
    return NextResponse.redirect(new URL(`/?error=1&next=${encodeURIComponent(next)}`, req.url), { status: 303 });
  }

  const res = NextResponse.redirect(new URL(next.startsWith("/") ? next : "/dashboard", req.url), { status: 303 });
  res.cookies.set(DASH_COOKIE_NAME, expectedCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}


