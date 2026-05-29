import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins";
import { prisma } from "@zapstore/db";

// Envia o magic link. Estrategia:
// 1. Se RESEND_API_KEY existe -> envia email de verdade via Resend.
// 2. Senao -> loga o link no console (dev e tambem prod sem email configurado).
//    Nunca lanca erro: melhor logar do que quebrar o login.
async function sendMagicLinkEmail(email: string, url: string): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.EMAIL_FROM ?? "Zapstore <onboarding@resend.dev>";

  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: email,
          subject: "Seu link de acesso ao Zapstore",
          html: `
            <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto">
              <h2>Entrar no Zapstore</h2>
              <p>Clique no botão abaixo pra acessar sua conta. O link expira em 5 minutos.</p>
              <p style="margin:24px 0">
                <a href="${url}" style="background:#171717;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block">
                  Acessar minha conta
                </a>
              </p>
              <p style="color:#666;font-size:13px">Se você não pediu esse link, ignore este e-mail.</p>
            </div>`,
        }),
      });
      if (!res.ok) {
        // eslint-disable-next-line no-console
        console.error("[MAGIC LINK] Resend falhou:", res.status, await res.text());
        // eslint-disable-next-line no-console
        console.log(`[MAGIC LINK] fallback para ${email}: ${url}`);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[MAGIC LINK] erro Resend:", e);
      // eslint-disable-next-line no-console
      console.log(`[MAGIC LINK] fallback para ${email}: ${url}`);
    }
    return;
  }

  // Sem provedor de email: loga no console.
  // eslint-disable-next-line no-console
  console.log("\n========================================");
  // eslint-disable-next-line no-console
  console.log(`[MAGIC LINK] enviar para ${email}:`);
  // eslint-disable-next-line no-console
  console.log(url);
  // eslint-disable-next-line no-console
  console.log("========================================\n");
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),

  secret: process.env.BETTER_AUTH_SECRET ?? "dev_only_change_me_in_production",
  baseURL: process.env.PUBLIC_APP_URL ?? "http://localhost:3000",

  // Email/password desligado — usamos magic link apenas (Fase 1).
  emailAndPassword: { enabled: false },

  // Google OAuth (opcional — habilita quando o dono configurar credenciais).
  socialProviders:
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : undefined,

  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url);
      },
    }),
  ],

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 dias
    updateAge: 60 * 60 * 24, // refresh diario
  },

  // O Prisma usa @db.Uuid nas chaves primarias. Geramos UUID v4 aqui pra
  // bater com o tipo do banco.
  advanced: {
    database: {
      generateId: () => randomUUID(),
    },
  },
});

export type Session = typeof auth.$Infer.Session;
