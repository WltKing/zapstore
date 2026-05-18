import { createWhatsAppProvider, type WhatsAppProvider } from "@zapstore/whatsapp";

let cached: WhatsAppProvider | null = null;

/** WhatsApp provider singleton para o painel (server-side). */
export function getWhatsAppProvider(): WhatsAppProvider {
  if (cached) return cached;
  cached = createWhatsAppProvider({
    provider: "evolution",
    apiUrl: process.env.EVOLUTION_API_URL ?? "http://localhost:8080",
    apiKey: process.env.EVOLUTION_API_KEY ?? "",
  });
  return cached;
}
