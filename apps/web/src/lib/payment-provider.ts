import { createPaymentProvider, type PaymentProvider } from "@zapstore/payment";

let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (cached) return cached;
  cached = createPaymentProvider({
    provider: "asaas",
    apiKey: process.env.ASAAS_API_KEY ?? "",
    env: (process.env.ASAAS_ENV as "sandbox" | "production") ?? "sandbox",
  });
  return cached;
}
