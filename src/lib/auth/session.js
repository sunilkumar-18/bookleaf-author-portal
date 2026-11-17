import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySession } from "./token";

/** For server components/layouts: the current user, or redirect to /login. */
export async function requireSessionUser(role) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const user = await verifySession(token);
  if (!user) redirect("/login");
  if (role && user.role !== role) redirect(user.role === "ADMIN" ? "/admin" : "/author");
  return user;
}
