import { NextResponse } from "next/server";
import { apiHandler, readJson } from "@/lib/api/handler";
import { loginSchema } from "@/lib/validation";
import { authenticate } from "@/lib/services/authService";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/token";

// POST /api/auth/login — public. Sets an httpOnly session cookie and also
// returns the token for API clients (Postman / curl) that prefer Bearer auth.
export const POST = apiHandler(
  async ({ req }) => {
    const { email, password } = loginSchema.parse(await readJson(req));
    const user = await authenticate(email, password);
    const token = await signSession(user);

    const res = NextResponse.json({ data: { user, token } });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return res;
  },
  { auth: false },
);
