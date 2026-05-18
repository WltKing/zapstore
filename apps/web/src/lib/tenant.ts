import { prisma } from "@zapstore/db";

/** Retorna a primeira loja em que o usuario e ADMIN, ou null se nao tem nenhuma. */
export async function getPrimaryTenantForUser(userId: string) {
  const link = await prisma.tenantUser.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      tenant: {
        include: { botConfig: true, subscription: true },
      },
    },
  });
  return link?.tenant ?? null;
}
