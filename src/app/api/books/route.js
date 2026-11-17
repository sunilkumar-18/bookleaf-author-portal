import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { listBooks } from "@/lib/services/bookService";

// GET /api/books — authors: own books + royalty summary; admins: all books (?authorId= to filter).
export const GET = apiHandler(async ({ req, user }) => {
  const authorId = req.nextUrl.searchParams.get("authorId") ?? undefined;
  return NextResponse.json(await listBooks(user, { authorId }));
});
