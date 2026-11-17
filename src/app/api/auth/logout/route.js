import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/token";

// POST /api/auth/logout — clears the session cookie. Safe to call when logged out.
export async function POST() {
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
