import { NextResponse, type NextRequest } from "next/server";
import { DASH_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.url), { status: 303 });
  res.cookies.set(DASH_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}



