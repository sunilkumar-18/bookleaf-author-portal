// Request schemas (zod). A ZodError thrown from .parse() becomes a 422 with per-field details.
import { z } from "zod";
import { CATEGORIES, PRIORITIES, STATUSES } from "./constants";

const enumOf = (obj) => z.enum(Object.keys(obj));

export const CategoryEnum = enumOf(CATEGORIES);
export const PriorityEnum = enumOf(PRIORITIES);
export const StatusEnum = enumOf(STATUSES);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const createTicketSchema = z.object({
  // null / "" / "GENERAL" all mean "General / Account level"
  bookId: z
    .string()
    .trim()
    .nullish()
    .transform((v) => (!v || v === "GENERAL" ? null : v)),
  subject: z.string().trim().min(5, "Subject should be at least 5 characters").max(150),
  description: z
    .string()
    .trim()
    .min(20, "Please describe the issue in a little more detail (at least 20 characters)")
    .max(5000),
  attachmentName: z.string().trim().max(255).nullish(),
});

export const updateTicketSchema = z
  .object({
    status: StatusEnum.optional(),
    category: CategoryEnum.optional(),
    priority: PriorityEnum.optional(),
    // "me" = assign to the calling admin, null = unassign
    assigneeId: z.union([z.literal("me"), z.string().cuid(), z.null()]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update" });

export const createMessageSchema = z.object({
  body: z.string().trim().min(1, "Message cannot be empty").max(10000),
  isInternal: z.boolean().optional().default(false),
  usedAiDraft: z.boolean().optional().default(false),
  // Optional status change in the same action ("Send & resolve")
  setStatus: StatusEnum.optional(),
});

export const listTicketsQuerySchema = z.object({
  // "active" = Open + In Progress (default for admins), "all" = no filter
  status: z.union([StatusEnum, z.literal("active"), z.literal("all")]).optional(),
  category: CategoryEnum.optional(),
  priority: PriorityEnum.optional(),
  assignee: z.enum(["me", "unassigned", "any"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
