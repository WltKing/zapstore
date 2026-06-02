import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { UsersView } from "./view";

export default async function UsersPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const myLink = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    include: { tenant: { select: { name: true } } },
  });
  if (!myLink) redirect("/onboarding");

  const links = await prisma.tenantUser.findMany({
    where: { tenantId: myLink.tenantId },
    include: { user: { select: { id: true, email: true, emailVerified: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <UsersView
      storeName={myLink.tenant.name}
      isAdmin={myLink.role === "ADMIN"}
      currentUserId={session.user.id}
      users={links.map((l) => ({
        userId: l.userId,
        email: l.user.email,
        role: l.role,
        verified: l.user.emailVerified,
      }))}
    />
  );
}
