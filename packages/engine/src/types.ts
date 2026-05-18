import type { LLMUsage } from "@zapstore/llm";

export interface TurnInput {
  tenantId: string;
  customerPhone: string;          // numero ou identificador unico (no simulador pode ser "sim:<userId>")
  customerName?: string;
  text: string;
}

export interface ToolExecution {
  name: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export interface TurnResult {
  replyText: string;
  toolExecutions: ToolExecution[];
  usage: LLMUsage;
  /** true se o bot esta bloqueado (cota estourada ou conversa pausada) */
  blocked?: "quota_exceeded" | "bot_paused";
}
