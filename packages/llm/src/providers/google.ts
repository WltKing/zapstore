import { randomUUID } from "node:crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LLMCompleteOptions, LLMProvider, LLMResponse, LLMToolCall } from "../types.js";

// Preço Gemini 2.5 Flash (similar a 2.0 Flash pra textos curtos).
const PRICE_USD_PER_1M_IN = 0.075;
const PRICE_USD_PER_1M_OUT = 0.3;
const USD_TO_BRL = 5.5;

export class GoogleProvider implements LLMProvider {
  readonly name = "google";
  readonly model: string;
  private client: GoogleGenerativeAI;

  constructor(opts: { apiKey: string; model: string }) {
    this.model = opts.model;
    this.client = new GoogleGenerativeAI(opts.apiKey);
  }

  async complete(opts: LLMCompleteOptions): Promise<LLMResponse> {
    // Converte tools pra schema Gemini (functionDeclarations).
    const tools =
      opts.tools && opts.tools.length > 0
        ? [
            {
              functionDeclarations: opts.tools.map((t) => ({
                name: t.name,
                description: t.description,
                parameters: t.inputSchema as Record<string, unknown>,
              })),
            },
          ]
        : undefined;

    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: opts.systemPrompt,
      // O SDK aceita o array de tools no formato Gemini.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: tools as any,
    });

    const history = opts.messages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const lastMessage = opts.messages[opts.messages.length - 1]?.content ?? "";

    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: opts.temperature ?? 0.2,
        maxOutputTokens: opts.maxTokens ?? 1024,
      },
    });

    const res = await chat.sendMessage(lastMessage);

    // Extrai texto. Quando o modelo retorna apenas function call, .text() pode
    // lancar erro ou retornar string vazia.
    let text = "";
    try {
      text = res.response.text();
    } catch {
      text = "";
    }

    // Extrai function calls.
    const toolCalls: LLMToolCall[] = [];
    const functionCalls = res.response.functionCalls();
    if (functionCalls) {
      for (const fc of functionCalls) {
        toolCalls.push({
          id: randomUUID(),
          name: fc.name,
          input: (fc.args ?? {}) as Record<string, unknown>,
        });
      }
    }

    const tokensIn = res.response.usageMetadata?.promptTokenCount ?? 0;
    const tokensOut = res.response.usageMetadata?.candidatesTokenCount ?? 0;
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
