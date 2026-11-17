import { prisma } from "@/lib/db";
import { royaltySummary } from "@/lib/royalty";

/** Authors get their own books + an account-level royalty summary; admins get every book. */
export async function listBooks(user, { authorId } = {}) {
  const where = user.role === "ADMIN" ? (authorId ? { authorId } : {}) : { authorId: user.authorId };

  const books = await prisma.book.findMany({
    where,
    // Published books first, newest first; books in production after.
    orderBy: [{ status: "asc" }, { publicationDate: { sort: "desc", nulls: "last" } }],
    include: user.role === "ADMIN" ? { author: { select: { id: true, name: true } } } : undefined,
  });

  const result = { data: books };
  if (user.role === "AUTHOR") {
    const s = royaltySummary(books);
    result.summary = {
      totalEarned: s.totalEarned,
      totalPaid: s.totalPaid,
      totalPending: s.totalPending,
      meetsThreshold: s.meetsThreshold,
      shortfallToThreshold: s.shortfallToThreshold,
      nextPayoutDate: s.nextPayout?.date ?? null,
      nextPayoutQuarter: s.nextPayout?.quarterLabel ?? null,
    };
  }
  return result;
}
