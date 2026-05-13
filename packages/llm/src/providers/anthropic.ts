import Anthropic from "@anthropic-ai/sdk";
import type { LLMCompleteOptions, LLMProvider, LLMResponse, LLMToolCall } from "../types.js";

// Preço Claude Haiku 4.5 (USD por 1M tokens). Atualizar quando preços mudarem.
const PRICE_USD_PER_1M_IN = 1.0;
const PRICE_USD_PER_1M_OUT = 5.0;
const USD_TO_BRL = 5.5;

export class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  readonly model: string;
  private client: Anthropic;

  constructor(opts: { apiKey: string; model: string }) {
    this.model = opts.model;
    this.client = new Anthropic({ apiKey: opts.apiKey });
  }

  async complete(opts: LLMCompleteOptions): Promise<LLMResponse> {
    const messages = opts.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.2,
      system: opts.systemPrompt,
      messages,
      tools: opts.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
      })),
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const toolCalls: LLMToolCall[] = res.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((b) => ({
        id: b.id,
        name: b.name,
        input: b.input as Record<string, unknown>,
      }));

    const tokensIn = res.usage.input_tokens;
    const tokensOut = res.usage.output_tokens;
    const costUsd =
      (tokensIn / 1_000_000) * PRICE_USD_PER_1M_IN +
      (tokensOut / 1_000_000) * PRICE_USD_PER_1M_OUT;

    return {
      text,
      toolCalls,
      usage: {
        tokensIn,
        tokensOut,
        costBrl: costUsd * USD_TO_BRL,
      },
      raw: res,
    };
  }
}
