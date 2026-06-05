// Chaves de plataforma editáveis no painel do super-admin. (sem "use server")
// IMPORTANTE: só liste aqui chaves que os serviços leem via getPlatformSetting,
// senão editar no painel não tem efeito.

export interface PlatformKeyDef {
  key: string;
  label: string;
  help: string;
  group: string;
}

export const PLATFORM_KEYS: PlatformKeyDef[] = [
  // IA / Bot
  { key: "GOOGLE_API_KEY", label: "Gemini (Google AI)", help: "Chave do bot. Google AI Studio / Google Cloud.", group: "Bot (IA)" },
  { key: "ANTHROPIC_API_KEY", label: "Anthropic (Claude) — opcional", help: "Fallback do bot, se usar.", group: "Bot (IA)" },

  // WhatsApp
  { key: "EVOLUTION_API_URL", label: "Evolution — URL", help: "Ex: https://evolution.seudominio.com", group: "WhatsApp" },
  { key: "EVOLUTION_API_KEY", label: "Evolution — API key", help: "Chave global da Evolution API.", group: "WhatsApp" },

  // Imagens (Cloudflare R2)
  { key: "R2_ACCOUNT_ID", label: "R2 — Account ID", help: "Upload de imagens (Cloudflare R2).", group: "Imagens (R2)" },
  { key: "R2_ACCESS_KEY_ID", label: "R2 — Access Key ID", help: "Credencial S3 do R2.", group: "Imagens (R2)" },
  { key: "R2_SECRET_ACCESS_KEY", label: "R2 — Secret Access Key", help: "Credencial S3 do R2.", group: "Imagens (R2)" },
  { key: "R2_BUCKET", label: "R2 — Bucket", help: "Nome do bucket.", group: "Imagens (R2)" },
  { key: "R2_PUBLIC_URL", label: "R2 — URL pública", help: "Ex: https://pub-xxxx.r2.dev", group: "Imagens (R2)" },

  // Fiscal
  { key: "FOCUS_NFE_MASTER_TOKEN", label: "Focus NFe — token da conta", help: "Gerencia empresas e certificados (emissão fiscal).", group: "Fiscal" },
  { key: "FOCUS_NFE_API_URL", label: "Focus NFe — URL da API (opcional)", help: "Padrão: https://api.focusnfe.com.br", group: "Fiscal" },

  // Pagamento (assinaturas)
  { key: "ASAAS_API_KEY", label: "Asaas — API key", help: "Cobrança das assinaturas (Pix/boleto/cartão).", group: "Pagamento" },
  { key: "ASAAS_ENV", label: "Asaas — ambiente", help: "'sandbox' (teste) ou 'production'.", group: "Pagamento" },

  // E-mail
  { key: "RESEND_API_KEY", label: "Resend — API key", help: "Envio de e-mail (link de acesso).", group: "E-mail" },
  { key: "EMAIL_FROM", label: "Resend — remetente", help: "Ex: Loja <contato@seudominio.com>", group: "E-mail" },
];

/** Mascara um segredo deixando só os últimos 4 caracteres. */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return "••••" + value.slice(-4);
}
