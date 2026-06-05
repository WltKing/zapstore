import { createPaymentProvider, type PaymentProvider } from "@zapstore/payment";
import { getPlatformSetting } from "@zapstore/db";

/** Provider de pagamento (Asaas). Chaves vêm do painel do dono (fallback env). */
export async function getPaymentProvider(): Promise<PaymentProvider> {
  const [apiKey, env] = await Promise.all([
    getPlatformSetting("ASAAS_API_KEY"),
    getPlatformSetting("ASAAS_ENV"),
  ]);
  return createPaymentProvider({
    provider: "asaas",
    apiKey: apiKey ?? "",
    env: env === "production" ? "production" : "sandbox",
  });
}
