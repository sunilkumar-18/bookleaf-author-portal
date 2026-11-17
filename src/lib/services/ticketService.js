// Ticket business logic. Route handlers stay thin: they validate input and call
// these functions. All role/ownership rules for tickets live here.
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";
import { ACTIVE_STATUSES } from "@/lib/constants";
import { classifyByRules } from "@/lib/ai/rules";
import { classifyTicket } from "@/lib/ai/classifier";
import { draftReply, templateReply } from "@/lib/ai/drafter";
import { aiAvailability, AiUnavailableError } from "@/lib/ai/client";

const isAdmin = (user) => user.role === "ADMIN";

const listInclude = {
  author: { select: { id: true, name: true } },
  book: { select: { id: true, title: true } },
  assignee: { select: { id: true, name: true } },
  _count: { select: { messages: true } },
};

// ---------------------------------------------------------------- serializers
// Authors get a reduced view: no internal notes, no AI internals, no assignee.

function serializeMessage(m) {
  return {
    id: m.id,
    body: m.body,
    isInternal: m.isInternal,
    usedAiDraft: m.usedAiDraft,
    createdAt: m.createdAt,
    sender: { id: m.sender.id, name: m.sender.name, role: m.sender.role },
  };
}

function serializeTicket(t, user) {
  const base = {
    id: t.id,
    number: t.number,
    subject: t.subject,
    description: t.description,
    attachmentName: t.attachmentName,
    status: t.status,
    category: t.category,
    book: t.book ? { id: t.book.id, title: t.book.title } : null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    resolvedAt: t.resolvedAt,
  };
  if (t.messages) {
    base.messages = t.messages.filter((m) => isAdmin(user) || !m.isInternal).map(serializeMessage);
  }
  if (!isAdmin(user)) return base;

  return {
    ...base,
    author: t.author ? { id: t.author.id, name: t.author.name, email: t.author.email } : null,
    book: t.book ?? null, // admins get the full book record (status, ISBN, royalties) for context
    categorySource: t.categorySource,
    priority: t.priority,
    prioritySource: t.prioritySource,
    aiStatus: t.aiStatus,
    aiReasoning: t.aiReasoning,
    assignee: t.assignee ? { id: t.assignee.id, name: t.assignee.name } : null,
    firstResponseAt: t.firstResponseAt,
    messageCount: t._count?.messages,
  };
}

// ---------------------------------------------------------------- queries

export async function listTickets(user, query) {
  const where = {};

  if (!isAdmin(user)) {
    where.authorId = user.authorId; // authors only ever see their own tickets
  }

  // Admin queue defaults to unresolved work; authors see everything they raised.
  const status = query.status ?? (isAdmin(user) ? "active" : "all");
  if (status === "active") where.status = { in: ACTIVE_STATUSES };
  else if (status !== "all") where.status = status;

  if (query.category) where.category = query.category;
  if (isAdmin(user) && query.priority) where.priority = query.priority;
  if (isAdmin(user) && query.assignee === "me") where.assigneeId = user.id;
  if (isAdmin(user) && query.assignee === "unassigned") where.assigneeId = null;
  if (query.from || query.to) where.createdAt = { gte: query.from, lte: endOfDay(query.to) };
  if (query.q) {
    where.OR = [
      { subject: { contains: query.q, mode: "insensitive" } },
      { author: { name: { contains: query.q, mode: "insensitive" } } },
      ...(Number.isInteger(Number(query.q)) ? [{ number: Number(query.q) }] : []),
    ];
  }

  // Admins: most urgent first, then oldest first (Priority enum is declared CRITICAL→LOW).
  // Authors: most recently updated first.
  const orderBy = isAdmin(user)
    ? [{ priority: "asc" }, { createdAt: "asc" }]
    : [{ updatedAt: "desc" }];

  const [items, total] = await prisma.$transaction([
    prisma.ticket.findMany({
      where,
      orderBy,
      // Authors see replies inline on "My Tickets"; admins open the ticket for the thread.
      include: isAdmin(user)
        ? listInclude
        : {
            ...listInclude,
            messages: {
              where: { isInternal: false },
              orderBy: { createdAt: "asc" },
              include: { sender: { select: { id: true, name: true, role: true } } },
            },
          },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.ticket.count({ where }),
  ]);

  const result = {
    data: items.map((t) => serializeTicket(t, user)),
    pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) },
  };

  if (isAdmin(user)) result.summary = await queueSummary(user);
  return result;
}

function endOfDay(d) {
  if (!d) return undefined;
  const e = new Date(d);
  e.setUTCHours(23, 59, 59, 999);
  return e;
}

/** Counters for the admin queue header. */
async function queueSummary(user) {
  const active = { status: { in: ACTIVE_STATUSES } };
  const [open, inProgress, critical, unassigned, mine] = await prisma.$transaction([
    prisma.ticket.count({ where: { status: "OPEN" } }),
    prisma.ticket.count({ where: { status: "IN_PROGRESS" } }),
    prisma.ticket.count({ where: { ...active, priority: "CRITICAL" } }),
    prisma.ticket.count({ where: { ...active, assigneeId: null } }),
    prisma.ticket.count({ where: { ...active, assigneeId: user.id } }),
  ]);
  return { open, inProgress, critical, unassigned, mine };
}

/** Load a ticket the user is allowed to see, or 404 (never reveal other authors' tickets exist). */
async function findAccessibleTicket(user, id, include) {
  const ticket = await prisma.ticket.findUnique({ where: { id }, include });
  if (!ticket || (!isAdmin(user) && ticket.authorId !== user.authorId)) {
    throw ApiError.notFound("Ticket");
  }
  return ticket;
}

const detailInclude = {
  author: { select: { id: true, name: true, email: true } },
  book: true,
  assignee: { select: { id: true, name: true } },
  messages: {
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { id: true, name: true, role: true } } },
  },
};

export async function getTicket(user, id) {
  const ticket = await findAccessibleTicket(user, id, detailInclude);
  return serializeTicket(ticket, user);
}

// ---------------------------------------------------------------- commands

export async function createTicket(user, input) {
  if (input.bookId) {
    const book = await prisma.book.findUnique({ where: { id: input.bookId }, select: { authorId: true } });
    if (!book || book.authorId !== user.authorId) {
      throw new ApiError(422, "VALIDATION_ERROR", "Invalid book selection", [
        { field: "bookId", message: "Select one of your own books or General / Account level" },
      ]);
    }
  }

  // Rule-based labels are applied instantly so the ticket is triaged even if
  // the AI is slow or down; the AI result (run after the response) replaces them.
  const rules = classifyByRules(input.subject, input.description);

  const ticket = await prisma.ticket.create({
    data: {
      authorId: user.authorId,
      bookId: input.bookId,
      subject: input.subject,
      description: input.description,
      attachmentName: input.attachmentName ?? null,
      category: rules.category,
      categorySource: "RULES",
      priority: rules.priority,
      prioritySource: "RULES",
      aiStatus: aiAvailability().available ? "PENDING" : "FAILED",
    },
    include: detailInclude,
  });

  return serializeTicket(ticket, user);
}

/**
 * Run AI classification for a ticket and store the result. Never throws:
 * on failure the rule-based labels simply stay in place. Labels an admin has
 * already overridden are never touched.
 */
export async function runAiTriage(ticketId) {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return;

  try {
    const result = await classifyTicket({ ticketId, subject: ticket.subject, description: ticket.description });
    const data = { aiStatus: "DONE", aiReasoning: result.reason };
    if (ticket.categorySource !== "ADMIN") Object.assign(data, { category: result.category, categorySource: "AI" });
    if (ticket.prioritySource !== "ADMIN") Object.assign(data, { priority: result.priority, prioritySource: "AI" });
    await prisma.ticket.update({ where: { id: ticketId }, data });
  } catch (err) {
    const reason = err instanceof AiUnavailableError ? err.reason : "Unexpected error";
    console.warn(`[ai] triage failed for ticket ${ticketId}: ${reason}`);
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { aiStatus: "FAILED", aiReasoning: `AI triage unavailable (${reason}); labels set by keyword rules.` },
    });
  }
}

export async function updateTicket(admin, id, patch) {
  const ticket = await findAccessibleTicket(admin, id);
  const data = {};

  if (patch.status && patch.status !== ticket.status) {
    data.status = patch.status;
    data.resolvedAt = ["RESOLVED", "CLOSED"].includes(patch.status) ? new Date() : null;
  }
  // Admin overrides are marked so later AI runs never overwrite a human decision.
  if (patch.category) Object.assign(data, { category: patch.category, categorySource: "ADMIN" });
  if (patch.priority) Object.assign(data, { priority: patch.priority, prioritySource: "ADMIN" });
  if (patch.category && patch.category !== ticket.category) {
    // Draft was grounded in the old category's knowledge base — regenerate on next open.
    Object.assign(data, { aiDraft: null, aiDraftSource: null, aiDraftAt: null });
  }

  if (patch.assigneeId !== undefined) {
    if (patch.assigneeId === null) data.assigneeId = null;
    else {
      const assigneeId = patch.assigneeId === "me" ? admin.id : patch.assigneeId;
      const assignee = await prisma.user.findUnique({ where: { id: assigneeId }, select: { role: true } });
      if (!assignee || assignee.role !== "ADMIN") throw ApiError.badRequest("Tickets can only be assigned to admins");
      data.assigneeId = assigneeId;
    }
  }

  const updated = await prisma.ticket.update({ where: { id }, data, include: detailInclude });
  return serializeTicket(updated, admin);
}

export async function addMessage(user, id, input) {
  const ticket = await findAccessibleTicket(user, id);
  const admin = isAdmin(user);

  if (!admin) {
    if (input.isInternal || input.setStatus) throw ApiError.forbidden("Authors cannot add internal notes or change status");
    if (ticket.status === "CLOSED") throw ApiError.conflict("This ticket is closed. Please raise a new ticket.");
  }

  const now = new Date();
  const ticketUpdate = {};

  if (admin && !input.isInternal) {
    if (!ticket.firstResponseAt) ticketUpdate.firstResponseAt = now;
    // Sensible default: replying to an open ticket means someone is working on it.
    if (ticket.status === "OPEN") ticketUpdate.status = "IN_PROGRESS";
    if (!ticket.assigneeId) ticketUpdate.assigneeId = user.id;
  }
  if (!admin && ticket.status === "RESOLVED") {
    ticketUpdate.status = "OPEN"; // author follow-up re-opens a resolved ticket
    ticketUpdate.resolvedAt = null;
  }
  if (admin && input.setStatus) {
    ticketUpdate.status = input.setStatus;
    ticketUpdate.resolvedAt = ["RESOLVED", "CLOSED"].includes(input.setStatus) ? now : null;
  }

  // The cached draft answered the previous state of the conversation.
  if (!input.isInternal) Object.assign(ticketUpdate, { aiDraft: null, aiDraftSource: null, aiDraftAt: null });

  await prisma.$transaction([
    prisma.ticketMessage.create({
      data: {
        ticketId: id,
        senderId: user.id,
        body: input.body,
        isInternal: admin ? input.isInternal : false,
        usedAiDraft: admin ? input.usedAiDraft : false,
      },
    }),
    prisma.ticket.update({ where: { id }, data: { ...ticketUpdate, updatedAt: now } }),
  ]);

  return getTicket(user, id);
}

/**
 * Return the AI draft for a ticket, generating it on first request and caching
 * it on the ticket. If the AI is unavailable, returns a tone-correct template
 * so the admin can still respond manually.
 */
export async function getDraft(admin, id, { regenerate = false } = {}) {
  const ticket = await findAccessibleTicket(admin, id, {
    book: true,
    author: { include: { books: { orderBy: { id: "asc" } } } },
    messages: { orderBy: { createdAt: "asc" }, include: { sender: { select: { role: true } } } },
  });

  if (ticket.aiDraft && !regenerate && ticket.aiDraftSource === "AI") {
    return { draft: ticket.aiDraft, source: "AI", generatedAt: ticket.aiDraftAt, cached: true };
  }

  try {
    const draft = await draftReply(ticket);
    const saved = await prisma.ticket.update({
      where: { id },
      data: { aiDraft: draft, aiDraftSource: "AI", aiDraftAt: new Date() },
    });
    return { draft, source: "AI", generatedAt: saved.aiDraftAt, cached: false };
  } catch (err) {
    const reason = err instanceof AiUnavailableError ? err.reason : "Unexpected error";
    console.warn(`[ai] draft failed for ticket ${id}: ${reason}`);
    return { draft: templateReply(ticket), source: "TEMPLATE", unavailableReason: reason, generatedAt: new Date(), cached: false };
  }
}

/** Admin-triggered re-run of AI triage (e.g. after an outage). Resets labels to AI-owned. */
export async function retriage(admin, id) {
  await findAccessibleTicket(admin, id);
  await prisma.ticket.update({
    where: { id },
    data: { categorySource: "RULES", prioritySource: "RULES", aiStatus: "PENDING" },
  });
  await runAiTriage(id);
  return getTicket(admin, id);
}
