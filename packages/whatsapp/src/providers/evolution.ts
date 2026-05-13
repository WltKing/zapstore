import type {
  IncomingMessage,
  InstanceStatus,
  OutgoingMessage,
  WhatsAppProvider,
} from "../types.js";

// Cliente HTTP minimal para Evolution API.
// Skeleton — Fase 1 implementa os endpoints reais (create instance, qrcode, send).

export class EvolutionProvider implements WhatsAppProvider {
  readonly name = "evolution";
  private apiUrl: string;
  private apiKey: string;

  constructor(opts: { apiUrl: string; apiKey: string }) {
    this.apiUrl = opts.apiUrl.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
  }

  private instanceName(tenantId: string): string {
    return `tenant_${tenantId}`;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      throw new Error(`Evolution API ${method} ${path} failed: ${res.status} ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  async ensureInstance(tenantId: string): Promise<InstanceStatus> {
    const name = this.instanceName(tenantId);
    // TODO Fase 1: POST /instance/create, GET /instance/connect/{name}
    void this.request;
    void name;
    return { connected: false };
  }

  async send(tenantId: string, msg: OutgoingMessage): Promise<void> {
    const name = this.instanceName(tenantId);
    // TODO Fase 1: POST /message/sendText/{name}
    void name;
    void msg;
  }

  async setTyping(tenantId: string, to: string, durationMs: number): Promise<void> {
    const name = this.instanceName(tenantId);
    // TODO Fase 1: POST /chat/presence/{name}
    void name;
    void to;
    void durationMs;
  }

  parseWebhook(_payload: unknown): IncomingMessage | null {
    // TODO Fase 1: implementar parser do webhook Evolution.
    return null;
  }
}
