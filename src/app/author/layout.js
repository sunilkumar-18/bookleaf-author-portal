import { AppShell } from "@/components/AppShell";
import { requireSessionUser } from "@/lib/auth/session";

const NAV = [
  { href: "/author", label: "My Books", exact: true },
  { href: "/author/tickets", label: "My Tickets" },
];

export default async function AuthorLayout({ children }) {
  const user = await requireSessionUser("AUTHOR");
  return (
    <AppShell user={user} nav={NAV} portalLabel="Author Portal">
      {children}
    </AppShell>
  );
}
