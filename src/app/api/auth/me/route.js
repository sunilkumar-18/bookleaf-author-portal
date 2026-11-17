import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";

// GET /api/auth/me — the current session's user.
export const GET = apiHandler(async ({ user }) => NextResponse.json({ data: user }));
