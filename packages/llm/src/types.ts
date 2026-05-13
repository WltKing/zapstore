export type LLMRole = "system" | "user" | "assistant" | "tool";

export interface LLMMessage {
  role: LLMRole;
  content: string;
  toolCallId?: string;
  toolName?: string;
}

export interface LLMTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface LLMUsage {
  tokensIn: number;
  tokensOut: number;
  costBrl: number;
}

export interface LLMToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LLMResponse {
  text: string;
  toolCalls: LLMToolCall[];
  usage: LLMUsage;
  raw: unknown;
}

export interface LLMCompleteOptions {
  systemPrompt: string;
  messages: LLMMessage[];
  tools?: LLMTool[];
  temperature?: number;
  maxTokens?: number;
}

export interface LLMProvider {
  readonly name: string;
  readonly model: string;
  complete(opts: LLMCompleteOptions): Promise<LLMResponse>;
}
