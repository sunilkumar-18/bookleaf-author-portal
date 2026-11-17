import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiAvailability } from "@/lib/ai/client";

// GET /api/health — public liveness check (DB + AI configuration). Exposes no secrets.
export async function GET() {
  let database = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "unavailable";
  }
  const ai = aiAvailability();
  return NextResponse.json(
    { status: database === "ok" ? "ok" : "degraded", database, ai: ai.available ? "ok" : ai.reason },
    { status: database === "ok" ? 200 : 503 },
  );
}
