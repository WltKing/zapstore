export interface IncomingMessage {
  tenantId: string;
  from: string;            // numero do cliente (E.164)
  fromName?: string;
  type: "text" | "audio" | "image" | "document" | "video" | "unknown";
  text?: string;
  mediaUrl?: string;
  mediaMime?: string;
  rawProviderMessageId: string;
  isFromBusiness: boolean; // true se foi o proprio lojista que mandou
  timestamp: Date;
}

export interface OutgoingMessage {
  to: string;
  text?: string;
  imageUrl?: string;
  audioUrl?: string;
  caption?: string;
}

export interface InstanceStatus {
  connected: boolean;
  qrCode?: string;
  phoneNumber?: string;
}

export interface WhatsAppProvider {
  readonly name: string;

  /** Cria/recupera a instance para o tenant e retorna o status (QR code se nao conectado). */
  ensureInstance(tenantId: string): Promise<InstanceStatus>;

  /** Envia uma mensagem (texto/imagem/audio). */
  send(tenantId: string, msg: OutgoingMessage): Promise<void>;

  /** Indica para o usuario que o bot esta "digitando". */
  setTyping(tenantId: string, to: string, durationMs: number): Promise<void>;

  /** Faz parse de um payload de webhook do provider para um IncomingMessage normalizado. */
  parseWebhook(payload: unknown): IncomingMessage | null;
}
