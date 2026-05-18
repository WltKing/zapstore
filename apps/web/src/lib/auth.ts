import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins";
import { prisma } from "@zapstore/db";

// Better-Auth config. Magic Link em dev loga o link no console;
// em producao integrar Resend/SES (Fase 1 polish).

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
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.log("\n========================================");
          // eslint-disable-next-line no-console
          console.log(`[MAGIC LINK] enviar para ${email}:`);
          // eslint-disable-next-line no-console
          console.log(url);
          // eslint-disable-next-line no-console
          console.log("========================================\n");
          return;
        }
        // TODO Fase 1 polish: integrar Resend
        throw new Error("Email provider nao configurado em producao");
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
