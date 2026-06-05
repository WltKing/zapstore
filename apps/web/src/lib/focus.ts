// Cliente da API Focus NFe (server-only). Doc: https://doc.focusnfe.com.br
// Auth: HTTP Basic com o token como usuário e senha em branco.
//
// - Gestão de EMPRESAS (criar/atualizar emitente + certificado) usa o token
//   MASTER da conta (env FOCUS_NFE_MASTER_TOKEN) na base de produção.
// - EMISSÃO (NFC-e/NF-e) usa o token DA EMPRESA (retornado no cadastro) na base
//   do ambiente escolhido (homologação/produção).

const API_PROD = "https://api.focusnfe.com.br";
const API_HOMOLOG = "https://homologacao.focusnfe.com.br";

function empresasBase(): string {
  return process.env.FOCUS_NFE_API_URL?.replace(/\/$/, "") ?? API_PROD;
}

export function emissionBase(ambiente: string): string {
  return ambiente === "producao" ? API_PROD : API_HOMOLOG;
}

function authHeader(token: string): string {
  return "Basic " + Buffer.from(`${token}:`).toString("base64");
}

export interface FocusResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

async function focusRequest<T = unknown>(
  url: string,
  token: string,
  method: string,
  body?: unknown,
): Promise<FocusResult<T>> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader(token),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  let data: unknown = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data: data as T };
}

export interface EmpresaPayload {
  nome: string;
  nome_fantasia?: string;
  cnpj: string;
  inscricao_estadual?: string;
  regime_tributario: number;
  email?: string;
  telefone?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  cep?: string;
  uf?: string;
  habilita_nfe?: boolean;
  habilita_nfce?: boolean;
  arquivo_certificado_base64?: string;
  senha_certificado?: string;
}

export interface EmpresaResponse {
  id?: number;
  token_producao?: string;
  token_homologacao?: string;
  certificado_valido_ate?: string;
  certificado_valido_de?: string;
  certificado_cnpj?: string;
  // erros
  codigo?: string;
  mensagem?: string;
  erros?: { mensagem?: string; campo?: string }[];
}

/** Mensagem de erro legível a partir da resposta do Focus. */
export function focusErrorMessage(data: unknown): string {
  if (data && typeof data === "object") {
    const d = data as EmpresaResponse & { raw?: string };
    if (d.mensagem) return d.mensagem;
    if (d.erros?.length) return d.erros.map((e) => e.mensagem).filter(Boolean).join("; ");
    if (d.raw) return d.raw.slice(0, 300);
  }
  return "Erro na comunicação com o Focus NFe.";
}

function masterToken(): string {
  const t = process.env.FOCUS_NFE_MASTER_TOKEN;
  if (!t) throw new Error("Focus NFe não configurado no servidor (FOCUS_NFE_MASTER_TOKEN ausente).");
  return t;
}

/** Cria uma empresa (emitente) no Focus, enviando o certificado A1. */
export function createEmpresa(payload: EmpresaPayload): Promise<FocusResult<EmpresaResponse>> {
  return focusRequest<EmpresaResponse>(`${empresasBase()}/v2/empresas`, masterToken(), "POST", payload);
}

/** Atualiza uma empresa existente (ex.: renovar certificado). */
export function updateEmpresa(
  id: number,
  payload: EmpresaPayload,
): Promise<FocusResult<EmpresaResponse>> {
  return focusRequest<EmpresaResponse>(
    `${empresasBase()}/v2/empresas/${id}`,
    masterToken(),
    "PUT",
    payload,
  );
}
