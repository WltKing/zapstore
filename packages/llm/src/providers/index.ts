import type { LLMProvider } from "../types.js";
import { AnthropicProvider } from "./anthropic.js";
import { GoogleProvider } from "./google.js";

export interface CreateLLMOptions {
  provider: "anthropic" | "google";
  model?: string;
  apiKey: string;
}

export function createLLMProvider(opts: CreateLLMOptions): LLMProvider {
  switch (opts.provider) {
    case "anthropic":
      return new AnthropicProvider({
        apiKey: opts.apiKey,
        model: opts.model ?? "claude-haiku-4-5-20251001",
      });
    case "google":
      return new GoogleProvider({
        apiKey: opts.apiKey,
        model: opts.model ?? "gemini-2.5-flash",
      });
    default: {
      const _exhaustive: never = opts.provider;
      throw new Error(`Unknown LLM provider: ${String(_exhaustive)}`);
    }
  }
}
