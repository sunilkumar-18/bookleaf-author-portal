import { AppShell } from "@/components/AppShell";
import { requireSessionUser } from "@/lib/auth/session";

const NAV = [{ href: "/admin", label: "Ticket Queue" }];

export default async function AdminLayout({ children }) {
  const user = await requireSessionUser("ADMIN");
  return (
    <AppShell user={user} nav={NAV} portalLabel="Operations">
      {children}
    </AppShell>
  );
}
