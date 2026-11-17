// Edge middleware: first line of defence.
//  - /author/* and /admin/* pages require the matching role (else redirect to /login)
//  - /api/* requires a valid session except the public endpoints below
// Route handlers re-check auth + roles themselves (apiHandler), so a
// misconfigured matcher can never expose data on its own.
import { NextResponse } from "next/server";
import { readToken, verifySession } from "@/lib/auth/token";

const PUBLIC_API = ["/api/auth/login", "/api/auth/logout", "/api/health"];

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const user = await verifySession(readToken(req));

  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API.includes(pathname) || user) return NextResponse.next();
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Please log in to continue" } }, { status: 401 });
  }

  const home = user?.role === "ADMIN" ? "/admin" : "/author";

  if (pathname === "/" || pathname === "/login") {
    if (user) return NextResponse.redirect(new URL(home, req.url));
    return pathname === "/" ? NextResponse.redirect(new URL("/login", req.url)) : NextResponse.next();
  }

  const requiredRole = pathname.startsWith("/admin") ? "ADMIN" : "AUTHOR";
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(pathname)}`, req.url));
  if (user.role !== requiredRole) return NextResponse.redirect(new URL(home, req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/author/:path*", "/admin/:path*", "/api/:path*"],
};
