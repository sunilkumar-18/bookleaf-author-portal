import { NextResponse } from "next/server";
import { apiHandler, readJson } from "@/lib/api/handler";
import { updateTicketSchema } from "@/lib/validation";
import { getTicket, updateTicket } from "@/lib/services/ticketService";

// GET /api/tickets/:id — full thread. Authors: own tickets only, internal notes hidden.
export const GET = apiHandler(async ({ user, params }) => {
  return NextResponse.json({ data: await getTicket(user, params.id) });
});

// PATCH /api/tickets/:id — admin: status, category/priority override, assignment.
export const PATCH = apiHandler(
  async ({ req, user, params }) => {
    const patch = updateTicketSchema.parse(await readJson(req));
    return NextResponse.json({ data: await updateTicket(user, params.id, patch) });
  },
  { roles: ["ADMIN"] },
);
