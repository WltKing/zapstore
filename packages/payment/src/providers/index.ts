import type { PaymentProvider } from "../types.js";
import { AsaasProvider } from "./asaas.js";

export interface CreatePaymentOptions {
  provider: "asaas";
  apiKey: string;
  env: "sandbox" | "production";
}

export function createPaymentProvider(opts: CreatePaymentOptions): PaymentProvider {
  switch (opts.provider) {
    case "asaas":
      return new AsaasProvider({ apiKey: opts.apiKey, env: opts.env });
    default: {
      const _exhaustive: never = opts.provider;
      throw new Error(`Unknown payment provider: ${String(_exhaustive)}`);
    }
  }
}
