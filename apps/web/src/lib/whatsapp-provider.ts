import { createWhatsAppProvider, type WhatsAppProvider } from "@zapstore/whatsapp";
import { getPlatformSetting } from "@zapstore/db";

/** WhatsApp provider (server-side). Chaves vêm do painel do dono (fallback env). */
export async function getWhatsAppProvider(): Promise<WhatsAppProvider> {
  const [apiUrl, apiKey] = await Promise.all([
    getPlatformSetting("EVOLUTION_API_URL"),
    getPlatformSetting("EVOLUTION_API_KEY"),
  ]);
  return createWhatsAppProvider({
    provider: "evolution",
    apiUrl: apiUrl ?? "http://localhost:8080",
    apiKey: apiKey ?? "",
  });
}
