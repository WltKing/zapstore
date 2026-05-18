import type {
  IncomingMessage,
  InstanceStatus,
  OutgoingMessage,
  WhatsAppProvider,
} from "../types.js";

// Cliente Evolution API v2 (atendai/evolution-api).
// Docs: https://doc.evolution-api.com/v2

interface EvolutionInstanceState {
  instance: { instanceName: string; state: "open" | "connecting" | "close" };
}

interface EvolutionCreateResponse {
  instance?: { instanceName?: string };
  qrcode?: { code?: string; base64?: string };
}

interface EvolutionFetchInstance {
  name?: string;
  instanceName?: string;
  connectionStatus?: "open" | "connecting" | "close";
}

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
      headers: { "Content-Type": "application/json", apikey: this.apiKey },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Evolution ${method} ${path}: ${res.status} ${text}`);
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : ({} as T)) as T;
  }

  /**
   * Garante que a instance existe. Retorna o status atual.
   *
   * IMPORTANTE: nao chama `/instance/connect` em chamadas subsequentes
   * (isso reinicia o canal Baileys e mata o QR atual). O QR sai apenas no
   * response do create — chamadas seguintes precisam pegar o QR via webhook
   * (event `qrcode.updated`) ou refazer a instance.
   */
  async ensureInstance(tenantId: string): Promise<InstanceStatus> {
    const name = this.instanceName(tenantId);

    // 1. Ja existe?
    let existing: EvolutionFetchInstance | undefined;
    try {
      const list = await this.request<EvolutionFetchInstance[]>(
        "GET",
        `/instance/fetchInstances?instanceName=${encodeURIComponent(name)}`,
      );
      existing = Array.isArray(list) ? list.find((i) => (i.name ?? i.instanceName) === name) : undefined;
    } catch {
      // sem cache
    }

    // 2. Se nao existe, cria. Response traz QR ja na primeira vez.
    if (!existing) {
      const created = await this.request<EvolutionCreateResponse>("POST", "/instance/create", {
        instanceName: name,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      });
      const qr = created.qrcode?.base64 ?? created.qrcode?.code;
      return { connected: false, qrCode: qr ?? undefined };
    }

    // 3. Ja existe — apenas le o estado (rapido, nao dispara reconexao).
    const state = await this.request<EvolutionInstanceState>(
      "GET",
      `/instance/connectionState/${encodeURIComponent(name)}`,
    );
    if (state.instance.state === "open") {
      return { connected: true };
    }

    // Para state=close ou connecting: o QR atual sai via webhook qrcode.updated.
    // Retornamos sem QR; o painel ou cache (Redis) cuida de mostrar o QR vindo
    // do webhook.
    return { connected: false };
  }

  /**
   * Forca um novo pareamento (chama /connect). Usar APENAS quando o QR atual
   * expirou e o usuario clicou em "Gerar novo QR".
   */
  async refreshQrCode(tenantId: string): Promise<string | undefined> {
    const name = this.instanceName(tenantId);
    try {
      const qr = await this.request<EvolutionCreateResponse["qrcode"]>(
        "GET",
        `/instance/connect/${encodeURIComponent(name)}`,
      );
      return qr?.base64 ?? qr?.code ?? undefined;
    } catch {
      return undefined;
    }
  }

  async send(tenantId: string, msg: OutgoingMessage): Promise<void> {
    const name = this.instanceName(tenantId);

    if (msg.imageUrl) {
      await this.request("POST", `/message/sendMedia/${encodeURIComponent(name)}`, {
        number: msg.to,
        mediatype: "image",
        media: msg.imageUrl,
        caption: msg.caption ?? msg.text ?? "",
      });
      return;
    }

    if (msg.audioUrl) {
      await this.request("POST", `/message/sendWhatsAppAudio/${encodeURIComponent(name)}`, {
        number: msg.to,
        audio: msg.audioUrl,
      });
      return;
    }

    if (msg.text) {
      await this.request("POST", `/message/sendText/${encodeURIComponent(name)}`, {
        number: msg.to,
        text: msg.text,
      });
    }
  }

  async setTyping(tenantId: string, to: string, durationMs: number): Promise<void> {
    const name = this.instanceName(tenantId);
    await this.request("POST", `/chat/sendPresence/${encodeURIComponent(name)}`, {
      number: to,
      presence: "composing",
      delay: durationMs,
    });
  }

  async disconnect(tenantId: string): Promise<void> {
    const name = this.instanceName(tenantId);
    try {
      await this.request("DELETE", `/instance/logout/${encodeURIComponent(name)}`);
    } catch {
      // ja desconectado
    }
    try {
      await this.request("DELETE", `/instance/delete/${encodeURIComponent(name)}`);
    } catch {
      // ja deletado
    }
  }

  /**
   * Extrai o QR (base64) de um payload de webhook `qrcode.updated`, se for o caso.
   * Retorna { tenantId, qrCode } pra cache no Redis.
   */
  parseQrCodeWebhook(payload: unknown): { tenantId: string; qrCode: string } | null {
    if (!payload || typeof payload !== "object") return null;
    const p = payload as Record<string, unknown>;
    if (p.event !== "qrcode.updated") return null;
    const data = p.data as Record<string, unknown> | undefined;
    const qr = data?.qrcode as Record<string, unknown> | undefined;
    const base64 = (qr?.base64 as string | undefined) ?? (qr?.code as string | undefined);
    const instance = String(p.instance ?? "");
    const tenantId = instance.startsWith("tenant_") ? instance.slice("tenant_".length) : instance;
    if (!base64 || !tenantId) return null;
    return { tenantId, qrCode: base64 };
  }

  /** Conecta/desconecta event do webhook. Retorna { tenantId, state }. */
  parseConnectionWebhook(payload: unknown): { tenantId: string; state: "open" | "connecting" | "close" } | null {
    if (!payload || typeof payload !== "object") return null;
    const p = payload as Record<string, unknown>;
    if (p.event !== "connection.update") return null;
    const data = p.data as Record<string, unknown> | undefined;
    const state = data?.state as string | undefined;
    if (state !== "open" && state !== "connecting" && state !== "close") return null;
    const instance = String(p.instance ?? "");
    const tenantId = instance.startsWith("tenant_") ? instance.slice("tenant_".length) : instance;
    if (!tenantId) return null;
    return { tenantId, state };
  }

  parseWebhook(payload: unknown): IncomingMessage | null {
    if (!payload || typeof payload !== "object") return null;
    const p = payload as Record<string, unknown>;
    const event = String(p.event ?? "");
    if (event !== "messages.upsert") return null;

    const data = p.data as Record<string, unknown> | undefined;
    if (!data) return null;

    const key = data.key as Record<string, unknown> | undefined;
    if (!key) return null;

    const fromMe = Boolean(key.fromMe);
    const remoteJid = String(key.remoteJid ?? "");
    if (!remoteJid || remoteJid.endsWith("@g.us")) return null;
    const fromName = (data.pushName as string | undefined) ?? undefined;

    const message = data.message as Record<string, unknown> | undefined;
    if (!message) return null;

    const messageType = String(data.messageType ?? "");
    let type: IncomingMessage["type"] = "unknown";
    let text: string | undefined;
    let mediaUrl: string | undefined;
    let mediaMime: string | undefined;

    if (typeof message.conversation === "string") {
      type = "text";
      text = message.conversation;
    } else if (message.extendedTextMessage) {
      type = "text";
      text = String((message.extendedTextMessage as Record<string, unknown>).text ?? "");
    } else if (messageType === "audioMessage" || message.audioMessage) {
      type = "audio";
      const audio = (message.audioMessage ?? data.audioMessage) as Record<string, unknown> | undefined;
      mediaUrl = (audio?.url as string | undefined) ?? undefined;
      mediaMime = (audio?.mimetype as string | undefined) ?? undefined;
    } else if (messageType === "imageMessage" || message.imageMessage) {
      type = "image";
      const img = (message.imageMessage ?? data.imageMessage) as Record<string, unknown> | undefined;
      mediaUrl = (img?.url as string | undefined) ?? undefined;
      mediaMime = (img?.mimetype as string | undefined) ?? undefined;
      text = (img?.caption as string | undefined) ?? undefined;
    } else if (messageType === "documentMessage" || message.documentMessage) {
      type = "document";
      const doc = (message.documentMessage ?? data.documentMessage) as Record<string, unknown> | undefined;
      mediaUrl = (doc?.url as string | undefined) ?? undefined;
      mediaMime = (doc?.mimetype as string | undefined) ?? undefined;
    } else if (messageType === "videoMessage" || message.videoMessage) {
      type = "video";
      const video = (message.videoMessage ?? data.videoMessage) as Record<string, unknown> | undefined;
      mediaUrl = (video?.url as string | undefined) ?? undefined;
      mediaMime = (video?.mimetype as string | undefined) ?? undefined;
    }

    const instance = String(p.instance ?? "");
    const tenantId = instance.startsWith("tenant_") ? instance.slice("tenant_".length) : instance;

    const timestamp =
      typeof data.messageTimestamp === "number"
        ? new Date(data.messageTimestamp * 1000)
        : new Date();

    return {
      tenantId,
      from: remoteJid.split("@")[0] ?? remoteJid,
      fromName,
      type,
      text,
      mediaUrl,
      mediaMime,
      rawProviderMessageId: String(key.id ?? ""),
      isFromBusiness: fromMe,
      timestamp,
    };
  }
}
