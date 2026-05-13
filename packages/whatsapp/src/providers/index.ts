import type { WhatsAppProvider } from "../types.js";
import { EvolutionProvider } from "./evolution.js";

export interface CreateWhatsAppOptions {
  provider: "evolution" | "meta_cloud";
  apiUrl?: string;
  apiKey: string;
}

export function createWhatsAppProvider(opts: CreateWhatsAppOptions): WhatsAppProvider {
  switch (opts.provider) {
    case "evolution":
      return new EvolutionProvider({
        apiUrl: opts.apiUrl ?? "http://localhost:8080",
        apiKey: opts.apiKey,
      });
    case "meta_cloud":
      throw new Error("Meta Cloud provider sera adicionado na Fase 4");
    default: {
      const _exhaustive: never = opts.provider;
      throw new Error(`Unknown WhatsApp provider: ${String(_exhaustive)}`);
    }
  }
}
