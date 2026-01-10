import { NextResponse, type NextRequest } from "next/server";
import { DASH_COOKIE_NAME, expectedCookieValue } from "@/lib/auth";

const PUBLIC_PATHS = new Set<string>([
  "/",
  "/api/login",
  "/api/logout",
]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow Next internals/static.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/fonts") ||
    pathname.startsWith("/images")
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  if (!pathname.startsWith("/dashboard")) return NextResponse.next();

  const cookie = req.cookies.get(DASH_COOKIE_NAME)?.value;
  if (!cookie || cookie !== expectedCookieValue()) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};





