"use client";
// Browser-side fetch wrapper for our own REST API. Auth rides on the httpOnly
// session cookie, so no token handling is needed here.

export class ApiClientError extends Error {
  constructor(status, error) {
    super(error?.message ?? "Request failed");
    this.status = status;
    this.code = error?.code;
    this.details = error?.details;
  }
}

export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (res.status === 401 && !path.startsWith("/api/auth/login")) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    throw new ApiClientError(401, { message: "Session expired" });
  }
  if (res.status === 204) return null;

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiClientError(res.status, json?.error);
  return json;
}

/** Map a validation error's details to { field: message } for inline form errors. */
export function fieldErrors(err) {
  if (!(err instanceof ApiClientError) || !Array.isArray(err.details)) return {};
  return Object.fromEntries(err.details.map((d) => [d.field, d.message]));
}
