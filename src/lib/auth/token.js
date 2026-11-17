// JWT helpers. Uses `jose` so the same code runs in Edge middleware and Node routes.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "bl_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters long");
  }
  return new TextEncoder().encode(secret);
}

/** @param {{ id: string, role: "AUTHOR"|"ADMIN", authorId: string|null, name: string, email: string }} user */
export async function signSession(user) {
  return new SignJWT({
    role: user.role,
    authorId: user.authorId,
    name: user.name,
    email: user.email,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

/** Returns the session payload, or null if the token is missing/invalid/expired. */
export async function verifySession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
    return {
      id: payload.sub,
      role: payload.role,
      authorId: payload.authorId ?? null,
      name: payload.name,
      email: payload.email,
    };
  } catch {
    return null;
  }
}

/** Token from the session cookie, or from an `Authorization: Bearer` header (API clients / Postman). */
export function readToken(request) {
  const header = request.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7);
  return request.cookies.get(SESSION_COOKIE)?.value ?? null;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
