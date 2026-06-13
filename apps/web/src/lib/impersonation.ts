import { cookies } from "next/headers";
import { getSuperAdminSession } from "@/lib/super-admin";

const COOKIE = "zap_impersonate";

/**
 * TenantId que o super-admin está "vendo como" (suporte), ou null.
 * Só vale se a sessão atual for de um super-admin — senão é ignorado.
 */
export async function getImpersonatedTenantId(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  const session = await getSuperAdminSession();
  if (!session) return null;
  return value;
}

export async function setImpersonationCookie(tenantId: string): Promise<void> {
  (await cookies()).set(COOKIE, tenantId, { httpOnly: true, sameSite: "lax", path: "/" });
}

export async function clearImpersonationCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
