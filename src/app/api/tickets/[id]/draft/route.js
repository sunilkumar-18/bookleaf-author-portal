import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { getDraft } from "@/lib/services/ticketService";

// GET /api/tickets/:id/draft — cached AI draft (generated on first request).
export const GET = apiHandler(
  async ({ user, params }) => NextResponse.json({ data: await getDraft(user, params.id) }),
  { roles: ["ADMIN"] },
);

// POST /api/tickets/:id/draft — force a fresh draft ("Regenerate").
export const POST = apiHandler(
  async ({ user, params }) => NextResponse.json({ data: await getDraft(user, params.id, { regenerate: true }) }),
  { roles: ["ADMIN"] },
);
