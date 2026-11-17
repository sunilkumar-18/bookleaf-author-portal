import { NextResponse } from "next/server";
import { apiHandler, readJson } from "@/lib/api/handler";
import { createMessageSchema } from "@/lib/validation";
import { addMessage } from "@/lib/services/ticketService";

// POST /api/tickets/:id/messages — admin reply / internal note, or author follow-up.
export const POST = apiHandler(async ({ req, user, params }) => {
  const input = createMessageSchema.parse(await readJson(req));
  return NextResponse.json({ data: await addMessage(user, params.id, input) }, { status: 201 });
});
