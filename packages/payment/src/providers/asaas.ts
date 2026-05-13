import type {
  CreateSubscriptionInput,
  PaymentProvider,
  SubscriptionResult,
  WebhookEvent,
} from "../types.js";

// Asaas API skeleton — Fase 1 implementa endpoints reais.
// Docs: https://docs.asaas.com/

const BASE = {
  sandbox: "https://sandbox.asaas.com/api/v3",
  production: "https://www.asaas.com/api/v3",
};

export class AsaasProvider implements PaymentProvider {
  readonly name = "asaas";
  private apiKey: string;
  private apiUrl: string;

  constructor(opts: { apiKey: string; env: "sandbox" | "production" }) {
    this.apiKey = opts.apiKey;
    this.apiUrl = BASE[opts.env];
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        access_token: this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      throw new Error(`Asaas ${method} ${path}: ${res.status} ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  async createSubscription(_input: CreateSubscriptionInput): Promise<SubscriptionResult> {
    // TODO Fase 1: POST /customers (cria/recupera) -> POST /subscriptions
    void this.request;
    throw new Error("Not implemented yet (Fase 1)");
  }

  async cancelSubscription(_providerSubId: string): Promise<void> {
    // TODO Fase 1: DELETE /subscriptions/{id}
    throw new Error("Not implemented yet (Fase 1)");
  }

  parseWebhook(_payload: unknown): WebhookEvent | null {
    // TODO Fase 1: mapear eventos Asaas (PAYMENT_RECEIVED, etc) para WebhookEvent.
    return null;
  }
}
