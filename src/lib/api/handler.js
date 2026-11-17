import { ApiError, errorResponse } from "./errors";
import { readToken, verifySession } from "@/lib/auth/token";

/**
 * Wraps a route handler with authentication, role checks and uniform error handling.
 *
 *   export const GET = apiHandler(async ({ req, user, params }) => {...}, { roles: ["ADMIN"] });
 *
 * - `auth: false` makes the route public (only used by /api/auth/login).
 * - `roles` restricts the route to the given roles (RBAC). Ownership checks for
 *   authors (e.g. "is this *your* ticket?") live in the service layer.
 */
export function apiHandler(fn, { auth = true, roles } = {}) {
  return async (req, ctx) => {
    try {
      let user = null;
      if (auth) {
        user = await verifySession(readToken(req));
        if (!user) throw ApiError.unauthorized();
        if (roles && !roles.includes(user.role)) throw ApiError.forbidden();
      }
      const params = ctx?.params ? await ctx.params : {};
      return await fn({ req, user, params });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Parse a JSON body, turning malformed JSON into a 400 instead of a 500. */
export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    throw ApiError.badRequest("Request body must be valid JSON");
  }
}
