import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LLMCompleteOptions, LLMProvider, LLMResponse } from "../types.js";

// Preço Gemini 2.0 Flash. Atualizar quando mudar.
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
    const model = this.client.getGenerativeModel({
      model: this.model,
      systemInstruction: opts.systemPrompt,
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
    const text = res.response.text();
    const tokensIn = res.response.usageMetadata?.promptTokenCount ?? 0;
    const tokensOut = res.response.usageMetadata?.candidatesTokenCount ?? 0;
    const costUsd =
      (tokensIn / 1_000_000) * PRICE_USD_PER_1M_IN +
      (tokensOut / 1_000_000) * PRICE_USD_PER_1M_OUT;

    return {
      text,
      toolCalls: [], // TODO: function calling Gemini na Fase 1
      usage: {
        tokensIn,
        tokensOut,
        costBrl: costUsd * USD_TO_BRL,
      },
      raw: res,
    };
  }
}
