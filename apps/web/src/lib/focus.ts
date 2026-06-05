// Cliente da API Focus NFe (server-only). Doc: https://doc.focusnfe.com.br
// Auth: HTTP Basic com o token como usuário e senha em branco.
//
// - Gestão de EMPRESAS (criar/atualizar emitente + certificado) usa o token
//   MASTER da conta (env FOCUS_NFE_MASTER_TOKEN) na base de produção.
// - EMISSÃO (NFC-e/NF-e) usa o token DA EMPRESA (retornado no cadastro) na base
//   do ambiente escolhido (homologação/produção).

import { getPlatformSetting } from "@zapstore/db";

const API_PROD = "https://api.focusnfe.com.br";
const API_HOMOLOG = "https://homologacao.focusnfe.com.br";

async function empresasBase(): Promise<string> {
  const url = await getPlatformSetting("FOCUS_NFE_API_URL");
  return url?.replace(/\/$/, "") ?? API_PROD;
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
  arquivo_logo_base64?: string;
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

// ============================================================
// EMISSÃO (NFC-e / NF-e) — usa o TOKEN DA EMPRESA + base do ambiente
// ============================================================

export interface NotaResponse {
  status?: string; // autorizado | erro_autorizacao | processando_autorizacao | cancelado
  status_sefaz?: string;
  mensagem_sefaz?: string;
  chave_nfe?: string;
  numero?: string;
  serie?: string;
  caminho_danfe?: string;
  caminho_xml_nota_fiscal?: string;
  erros?: { mensagem?: string; campo?: string }[];
  mensagem?: string;
}

/** Emite uma nota (model = "nfce" | "nfe"). ref é a referência única. */
export async function emitNota(
  model: "nfce" | "nfe",
  ambiente: string,
  empresaToken: string,
  ref: string,
  payload: unknown,
): Promise<FocusResult<NotaResponse>> {
  return focusRequest<NotaResponse>(
    `${emissionBase(ambiente)}/v2/${model}?ref=${encodeURIComponent(ref)}`,
    empresaToken,
    "POST",
    payload,
  );
}

/** Consulta o status de uma nota emitida. */
export async function consultarNota(
  model: "nfce" | "nfe",
  ambiente: string,
  empresaToken: string,
  ref: string,
): Promise<FocusResult<NotaResponse>> {
  return focusRequest<NotaResponse>(
    `${emissionBase(ambiente)}/v2/${model}/${encodeURIComponent(ref)}`,
    empresaToken,
    "GET",
  );
}

/** Cancela uma nota autorizada (justificativa mín. 15 caracteres). */
export async function cancelarNota(
  model: "nfce" | "nfe",
  ambiente: string,
  empresaToken: string,
  ref: string,
  justificativa: string,
): Promise<FocusResult<NotaResponse>> {
  return focusRequest<NotaResponse>(
    `${emissionBase(ambiente)}/v2/${model}/${encodeURIComponent(ref)}`,
    empresaToken,
    "DELETE",
    { justificativa },
  );
}

/** URL absoluta de um caminho retornado pelo Focus (danfe/xml). */
export function focusFileUrl(ambiente: string, caminho: string | undefined): string | null {
  if (!caminho) return null;
  if (/^https?:\/\//.test(caminho)) return caminho;
  return `${emissionBase(ambiente)}${caminho.startsWith("/") ? "" : "/"}${caminho}`;
}

async function masterToken(): Promise<string> {
  const t = await getPlatformSetting("FOCUS_NFE_MASTER_TOKEN");
  if (!t) {
    throw new Error(
      "Focus NFe não configurado: defina o token da conta em Painel do dono → Chaves (FOCUS_NFE_MASTER_TOKEN).",
    );
  }
  return t;
}

/** Cria uma empresa (emitente) no Focus, enviando o certificado A1. */
export async function createEmpresa(payload: EmpresaPayload): Promise<FocusResult<EmpresaResponse>> {
  return focusRequest<EmpresaResponse>(`${await empresasBase()}/v2/empresas`, await masterToken(), "POST", payload);
}

/** Busca uma empresa já cadastrada no Focus pelo CNPJ (ou null). */
export async function findEmpresaByCnpj(cnpj: string): Promise<EmpresaResponse | null> {
  const res = await focusRequest<EmpresaResponse[] | EmpresaResponse>(
    `${await empresasBase()}/v2/empresas?cnpj=${encodeURIComponent(cnpj)}`,
    await masterToken(),
    "GET",
  );
  if (!res.ok) return null;
  const data = res.data;
  if (Array.isArray(data)) return data[0] ?? null;
  return data && (data as EmpresaResponse).id ? (data as EmpresaResponse) : null;
}

/** Atualiza uma empresa existente (ex.: renovar certificado). */
export async function updateEmpresa(
  id: number,
  payload: EmpresaPayload,
): Promise<FocusResult<EmpresaResponse>> {
  return focusRequest<EmpresaResponse>(
    `${await empresasBase()}/v2/empresas/${id}`,
    await masterToken(),
    "PUT",
    payload,
  );
}
