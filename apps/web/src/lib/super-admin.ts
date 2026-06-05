import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/** E-mails com acesso ao painel do dono do SaaS (super-admin). */
export function superAdminEmails(): string[] {
  const env = process.env.SUPER_ADMIN_EMAILS;
  const list = env ? env.split(",") : ["welingtonreis@outlook.com"]; // default: dono
  return list.map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export function isSuperAdminEmail(email?: string | null): boolean {
  return !!email && superAdminEmails().includes(email.toLowerCase());
}

/** Sessão se (e só se) for super-admin; senão null. */
export async function getSuperAdminSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return isSuperAdminEmail(session.user.email) ? session : null;
}
