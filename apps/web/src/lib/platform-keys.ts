// Chaves de plataforma editáveis no painel do super-admin. (sem "use server")

export interface PlatformKeyDef {
  key: string;
  label: string;
  help: string;
}

export const PLATFORM_KEYS: PlatformKeyDef[] = [
  { key: "GOOGLE_API_KEY", label: "Gemini (Google AI)", help: "Chave do bot. Google AI Studio / Google Cloud." },
  { key: "ANTHROPIC_API_KEY", label: "Anthropic (Claude) — opcional", help: "Fallback do bot, se usar." },
  { key: "FOCUS_NFE_MASTER_TOKEN", label: "Focus NFe — token da conta", help: "Gerencia empresas e certificados (emissão fiscal)." },
  { key: "FOCUS_NFE_API_URL", label: "Focus NFe — URL da API (opcional)", help: "Padrão: https://api.focusnfe.com.br" },
  { key: "RESEND_API_KEY", label: "Resend (e-mail) — opcional", help: "Envio de e-mails (magic link)." },
];

/** Mascara um segredo deixando só os últimos 4 caracteres. */
export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return "••••" + value.slice(-4);
}
