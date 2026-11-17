import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { retriage } from "@/lib/services/ticketService";

// POST /api/tickets/:id/triage — re-run AI classification (e.g. after an AI outage).
export const POST = apiHandler(
  async ({ user, params }) => NextResponse.json({ data: await retriage(user, params.id) }),
  { roles: ["ADMIN"] },
);
