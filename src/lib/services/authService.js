import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/errors";

// Hash used when the email doesn't exist, so response time doesn't reveal
// whether an account exists (bcrypt.compare still runs).
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.Jq0Q1Q6p3xFh6Z4rI7r3f2k5yW1C";

export async function authenticate(email, password) {
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Incorrect email or password");
  }
  return publicUser(user);
}

export function publicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, authorId: user.authorId };
}
