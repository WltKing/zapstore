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

  /** Desconecta a instance (logout). */
  disconnect(tenantId: string): Promise<void>;

  /** Forca refresh do QR (chama /connect). Use apenas quando QR expirou. */
  refreshQrCode(tenantId: string): Promise<string | undefined>;

  /** Faz parse de um payload de webhook do provider para um IncomingMessage normalizado. */
  parseWebhook(payload: unknown): IncomingMessage | null;

  /** Parse de webhook qrcode.updated. Retorna { tenantId, qrCode } se for esse tipo. */
  parseQrCodeWebhook(payload: unknown): { tenantId: string; qrCode: string } | null;

  /** Parse de webhook connection.update. Retorna { tenantId, state } se for esse tipo. */
  parseConnectionWebhook(payload: unknown): {
    tenantId: string;
    state: "open" | "connecting" | "close";
  } | null;
}
