import { after, NextResponse } from "next/server";
import { apiHandler, readJson } from "@/lib/api/handler";
import { createTicketSchema, listTicketsQuerySchema } from "@/lib/validation";
import { createTicket, listTickets, runAiTriage } from "@/lib/services/ticketService";

// GET /api/tickets — authors: own tickets; admins: queue with filters + summary counters.
export const GET = apiHandler(async ({ req, user }) => {
  const query = listTicketsQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  return NextResponse.json(await listTickets(user, query));
});

// POST /api/tickets — authors raise a ticket. Responds immediately; AI triage
// runs after the response is sent (after() keeps the serverless function alive
// for it), so a slow or failing AI never blocks ticket creation.
export const POST = apiHandler(
  async ({ req, user }) => {
    const input = createTicketSchema.parse(await readJson(req));
    const ticket = await createTicket(user, input);
    after(() => runAiTriage(ticket.id));
    return NextResponse.json({ data: ticket }, { status: 201 });
  },
  { roles: ["AUTHOR"] },
);
