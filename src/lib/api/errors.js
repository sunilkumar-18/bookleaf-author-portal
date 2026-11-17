import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";

/** An error that maps directly to an HTTP response. Throw it from services/handlers. */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, "BAD_REQUEST", message, details);
  }
  static unauthorized(message = "Please log in to continue") {
    return new ApiError(401, "UNAUTHORIZED", message);
  }
  static forbidden(message = "You do not have access to this resource") {
    return new ApiError(403, "FORBIDDEN", message);
  }
  static notFound(resource = "Resource") {
    return new ApiError(404, "NOT_FOUND", `${resource} not found`);
  }
  static conflict(message) {
    return new ApiError(409, "CONFLICT", message);
  }
}

/** Every error leaves the API in one shape: { error: { code, message, details? } } */
export function errorResponse(err) {
  if (err instanceof ApiError) {
    return json(err.status, { code: err.code, message: err.message, details: err.details });
  }

  if (err instanceof ZodError) {
    return json(422, {
      code: "VALIDATION_ERROR",
      message: "Some fields are missing or invalid",
      details: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") return json(404, { code: "NOT_FOUND", message: "Record not found" });
    if (err.code === "P2002") return json(409, { code: "CONFLICT", message: "Record already exists" });
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error("[db] connection failed:", err.message);
    return json(503, { code: "DATABASE_UNAVAILABLE", message: "Database is temporarily unavailable" });
  }

  // Unknown failure: log the details server-side, never leak them to the client.
  console.error("[api] unhandled error:", err);
  return json(500, { code: "INTERNAL_ERROR", message: "Something went wrong on our side. Please try again." });
}

function json(status, error) {
  return NextResponse.json({ error }, { status });
}
