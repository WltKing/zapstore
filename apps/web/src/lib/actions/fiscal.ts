"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma, withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import {
  createEmpresa,
  updateEmpresa,
  findEmpresaByCnpj,
  focusErrorMessage,
  type EmpresaPayload,
} from "@/lib/focus";

/** Exige ADMIN da loja. Retorna tenantId. */
async function requireAdminTenant(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Nao autenticado");
  const link = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!link) throw new Error("Voce nao tem loja cadastrada");
  if (link.role !== "ADMIN") throw new Error("Apenas o administrador configura o fiscal.");
  return link.tenantId;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface FiscalConfigInput {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia?: string;
  inscricaoEstadual?: string;
  regimeTributario: number;
  email?: string;
  telefone?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  codigoMunicipio?: string;
  uf?: string;
  ambiente: string;
  habilitaNfce: boolean;
  habilitaNfe: boolean;
  cscNfceProd?: string;
  idTokenNfceProd?: string;
  // A empresa já emitiu notas antes (em outro sistema)? Se sim, numeração é obrigatória.
  emitiuAntes?: boolean;
  // Numeração (strings no form; convertidas pra int ou null)
  serieNfeHomolog?: string;
  proxNumNfeHomolog?: string;
  serieNfeProd?: string;
  proxNumNfeProd?: string;
  serieNfceHomolog?: string;
  proxNumNfceHomolog?: string;
  serieNfceProd?: string;
  proxNumNfceProd?: string;
}

function onlyDigits(s: string | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

/** "31" → 31; vazio/inválido → null. */
function toIntOrNull(s: string | undefined): number | null {
  const n = parseInt((s ?? "").trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Salva os dados da empresa/ambiente (sem mexer no certificado). */
export async function saveFiscalConfigAction(input: FiscalConfigInput): Promise<ActionResult> {
  try {
    const tenantId = await requireAdminTenant();
    const cnpj = onlyDigits(input.cnpj);
    if (cnpj.length !== 14) return { ok: false, error: "CNPJ inválido (14 dígitos)." };
    if (!input.razaoSocial.trim()) return { ok: false, error: "Informe a razão social." };
    // Campos exigidos pra emissão (SEFAZ rejeita sem eles).
    if (!input.inscricaoEstadual?.trim()) return { ok: false, error: "Informe a inscrição estadual (ou ISENTO)." };
    if (onlyDigits(input.cep).length !== 8) return { ok: false, error: "Informe o CEP da empresa." };
    if (!input.logradouro?.trim()) return { ok: false, error: "Informe o logradouro (rua/avenida)." };
    if (!input.numero?.trim()) return { ok: false, error: "Informe o número do endereço." };
    if (!input.bairro?.trim()) return { ok: false, error: "Informe o bairro." };
    if (!input.municipio?.trim()) return { ok: false, error: "Informe o município." };
    if (onlyDigits(input.codigoMunicipio).length !== 7) return { ok: false, error: "Informe o código IBGE do município (7 dígitos — preenchido pelo CEP)." };
    if ((input.uf ?? "").trim().length !== 2) return { ok: false, error: "Informe a UF." };
    if (input.habilitaNfce && (!input.cscNfceProd?.trim() || !input.idTokenNfceProd?.trim())) {
      return { ok: false, error: "Pra emitir NFC-e, informe o CSC e o ID do token (gerados no site da SEFAZ do seu estado)." };
    }
    // Já emitiu antes → numeração obrigatória pros documentos habilitados (senão a SEFAZ rejeita por nº repetido).
    const emitiuAntes = Boolean(input.emitiuAntes);
    if (emitiuAntes) {
      if (input.habilitaNfce && (toIntOrNull(input.serieNfceProd) == null || toIntOrNull(input.proxNumNfceProd) == null)) {
        return { ok: false, error: "Informe a série e o próximo número da NFC-e (empresa que já emitiu antes)." };
      }
      if (input.habilitaNfe && (toIntOrNull(input.serieNfeProd) == null || toIntOrNull(input.proxNumNfeProd) == null)) {
        return { ok: false, error: "Informe a série e o próximo número da NF-e (empresa que já emitiu antes)." };
      }
    }
    // Sem ambiente de teste pro lojista: emissão sempre em produção.
    const ambiente = "producao";

    const data = {
      cnpj,
      razaoSocial: input.razaoSocial.trim(),
      nomeFantasia: input.nomeFantasia?.trim() || null,
      inscricaoEstadual: input.inscricaoEstadual?.trim() || null,
      regimeTributario: [1, 2, 3].includes(input.regimeTributario) ? input.regimeTributario : 1,
      email: input.email?.trim() || null,
      telefone: input.telefone?.trim() || null,
      cep: onlyDigits(input.cep) || null,
      logradouro: input.logradouro?.trim() || null,
      numero: input.numero?.trim() || null,
      complemento: input.complemento?.trim() || null,
      bairro: input.bairro?.trim() || null,
      municipio: input.municipio?.trim() || null,
      codigoMunicipio: input.codigoMunicipio?.trim() || null,
      uf: input.uf?.trim().toUpperCase() || null,
      ambiente,
      habilitaNfce: input.habilitaNfce,
      habilitaNfe: input.habilitaNfe,
      cscNfceProd: input.cscNfceProd?.trim() || null,
      idTokenNfceProd: input.idTokenNfceProd?.trim() || null,
      serieNfeHomolog: toIntOrNull(input.serieNfeHomolog),
      proxNumNfeHomolog: toIntOrNull(input.proxNumNfeHomolog),
      serieNfeProd: emitiuAntes ? toIntOrNull(input.serieNfeProd) : null,
      proxNumNfeProd: emitiuAntes ? toIntOrNull(input.proxNumNfeProd) : null,
      serieNfceHomolog: toIntOrNull(input.serieNfceHomolog),
      proxNumNfceHomolog: toIntOrNull(input.proxNumNfceHomolog),
      serieNfceProd: emitiuAntes ? toIntOrNull(input.serieNfceProd) : null,
      proxNumNfceProd: emitiuAntes ? toIntOrNull(input.proxNumNfceProd) : null,
    };

    const saved = await withTenant(tenantId, async (tx) => {
      return tx.fiscalConfig.upsert({
        where: { tenantId },
        create: { tenantId, ...data },
        update: data,
      });
    });

    // Empresa já cadastrada no emissor → propaga os dados (CSC, numeração, endereço...).
    if (saved.focusEmpresaId) {
      const res = await updateEmpresa(saved.focusEmpresaId, empresaPayloadFromConfig(saved));
      if (!res.ok) {
        return {
          ok: false,
          error: `Dados salvos, mas o emissor recusou a atualização: ${focusErrorMessage(res.data)}`,
        };
      }
    }

    revalidatePath("/fiscal");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

/** Monta o payload da empresa a partir da config salva (sem certificado/logo). */
function empresaPayloadFromConfig(cfg: {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  inscricaoEstadual: string | null;
  regimeTributario: number;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  habilitaNfce: boolean;
  habilitaNfe: boolean;
  cscNfceProd?: string | null;
  idTokenNfceProd?: string | null;
  serieNfeHomolog?: number | null;
  proxNumNfeHomolog?: number | null;
  serieNfeProd?: number | null;
  proxNumNfeProd?: number | null;
  serieNfceHomolog?: number | null;
  proxNumNfceHomolog?: number | null;
  serieNfceProd?: number | null;
  proxNumNfceProd?: number | null;
}): EmpresaPayload {
  return {
    nome: cfg.razaoSocial,
    nome_fantasia: cfg.nomeFantasia ?? undefined,
    cnpj: cfg.cnpj,
    inscricao_estadual: cfg.inscricaoEstadual ?? undefined,
    regime_tributario: cfg.regimeTributario,
    email: cfg.email ?? undefined,
    telefone: cfg.telefone ?? undefined,
    logradouro: cfg.logradouro ?? undefined,
    numero: cfg.numero ?? undefined,
    complemento: cfg.complemento ?? undefined,
    bairro: cfg.bairro ?? undefined,
    municipio: cfg.municipio ?? undefined,
    cep: cfg.cep ?? undefined,
    uf: cfg.uf ?? undefined,
    habilita_nfe: cfg.habilitaNfe,
    habilita_nfce: cfg.habilitaNfce,
    // CSC/token do NFC-e (produção) e numeração — só vão se preenchidos.
    csc_nfce_producao: cfg.cscNfceProd ?? undefined,
    id_token_nfce_producao: cfg.idTokenNfceProd ?? undefined,
    serie_nfe_homologacao: cfg.serieNfeHomolog ?? undefined,
    proximo_numero_nfe_homologacao: cfg.proxNumNfeHomolog ?? undefined,
    serie_nfe_producao: cfg.serieNfeProd ?? undefined,
    proximo_numero_nfe_producao: cfg.proxNumNfeProd ?? undefined,
    serie_nfce_homologacao: cfg.serieNfceHomolog ?? undefined,
    proximo_numero_nfce_homologacao: cfg.proxNumNfceHomolog ?? undefined,
    serie_nfce_producao: cfg.serieNfceProd ?? undefined,
    proximo_numero_nfce_producao: cfg.proxNumNfceProd ?? undefined,
  };
}

/**
 * Envia a logo da loja (a que foi subida no Zapstore) pro Focus, pra aparecer no
 * DANFE/cupom daquela empresa. Busca a imagem do R2 no servidor (sem CORS) e
 * manda como arquivo_logo_base64 no update da empresa.
 */
export async function syncFiscalLogoForTenant(tenantId: string): Promise<ActionResult> {
  try {
    const [cfg, tenant] = await Promise.all([
      withTenant(tenantId, (tx) => tx.fiscalConfig.findUnique({ where: { tenantId } })),
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { logoUrl: true } }),
    ]);
    if (!cfg?.focusEmpresaId) return { ok: false, error: "Empresa fiscal ainda não cadastrada." };
    if (!tenant?.logoUrl) return { ok: false, error: "Loja sem logo cadastrada." };

    const resp = await fetch(tenant.logoUrl, { cache: "no-store" });
    if (!resp.ok) return { ok: false, error: "Não consegui baixar a logo da loja." };
    const b64 = Buffer.from(await resp.arrayBuffer()).toString("base64");

    const payload: EmpresaPayload = { ...empresaPayloadFromConfig(cfg), arquivo_logo_base64: b64 };
    const res = await updateEmpresa(cfg.focusEmpresaId, payload);
    if (!res.ok) return { ok: false, error: focusErrorMessage(res.data) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function syncFiscalLogoAction(): Promise<ActionResult> {
  try {
    const tenantId = await requireAdminTenant();
    const r = await syncFiscalLogoForTenant(tenantId);
    if (r.ok) revalidatePath("/fiscal");
    return r;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

/**
 * Vincula a uma empresa JÁ cadastrada no Focus (pelo CNPJ), puxando os tokens —
 * sem reenviar o certificado. Útil quando a loja já existe no Focus (caso do dono).
 */
export async function linkExistingEmpresaAction(): Promise<ActionResult> {
  try {
    const tenantId = await requireAdminTenant();
    const cfg = await withTenant(tenantId, (tx) => tx.fiscalConfig.findUnique({ where: { tenantId } }));
    if (!cfg) return { ok: false, error: "Salve os dados da empresa primeiro." };

    const found = await findEmpresaByCnpj(cfg.cnpj);
    if (!found?.id) {
      return {
        ok: false,
        error: "Não encontramos um cadastro anterior dessa empresa pelo CNPJ. Envie o certificado pra cadastrar.",
      };
    }

    await withTenant(tenantId, (tx) =>
      tx.fiscalConfig.update({
        where: { tenantId },
        data: {
          focusEmpresaId: found.id,
          focusTokenHomolog: found.token_homologacao ?? cfg.focusTokenHomolog,
          focusTokenProd: found.token_producao ?? cfg.focusTokenProd,
          certStatus: "ok",
          enabled: true,
        },
      }),
    );
    revalidatePath("/fiscal");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

/**
 * Envia o certificado A1 (base64) + senha ao Focus: cria a empresa (1ª vez) ou
 * atualiza (renovação). Guarda os tokens de emissão e a validade do certificado.
 * NÃO persiste o .pfx nem a senha.
 */
export async function uploadCertificateAction(
  certBase64: string,
  senha: string,
): Promise<ActionResult> {
  try {
    const tenantId = await requireAdminTenant();
    if (!certBase64 || !senha) return { ok: false, error: "Envie o arquivo .pfx e a senha." };

    const cfg = await withTenant(tenantId, (tx) => tx.fiscalConfig.findUnique({ where: { tenantId } }));
    if (!cfg) return { ok: false, error: "Salve os dados da empresa antes de enviar o certificado." };

    const payload: EmpresaPayload = {
      nome: cfg.razaoSocial,
      nome_fantasia: cfg.nomeFantasia ?? undefined,
      cnpj: cfg.cnpj,
      inscricao_estadual: cfg.inscricaoEstadual ?? undefined,
      regime_tributario: cfg.regimeTributario,
      email: cfg.email ?? undefined,
      telefone: cfg.telefone ?? undefined,
      logradouro: cfg.logradouro ?? undefined,
      numero: cfg.numero ?? undefined,
      complemento: cfg.complemento ?? undefined,
      bairro: cfg.bairro ?? undefined,
      municipio: cfg.municipio ?? undefined,
      cep: cfg.cep ?? undefined,
      uf: cfg.uf ?? undefined,
      habilita_nfe: cfg.habilitaNfe,
      habilita_nfce: cfg.habilitaNfce,
      arquivo_certificado_base64: certBase64,
      senha_certificado: senha,
    };

    // Descobre a empresa: id já salvo; senão procura no Focus pelo CNPJ (caso a
    // empresa já exista lá — ex.: a própria loja do dono). Só cria se não achar.
    let empresaId = cfg.focusEmpresaId ?? null;
    let existingHomolog: string | null = null;
    let existingProd: string | null = null;
    if (!empresaId) {
      const found = await findEmpresaByCnpj(cfg.cnpj);
      if (found?.id) {
        empresaId = found.id;
        existingHomolog = found.token_homologacao ?? null;
        existingProd = found.token_producao ?? null;
      }
    }

    const res = empresaId
      ? await updateEmpresa(empresaId, payload)
      : await createEmpresa(payload);

    if (!res.ok) {
      await withTenant(tenantId, (tx) =>
        tx.fiscalConfig.update({ where: { tenantId }, data: { certStatus: "erro" } }),
      );
      return { ok: false, error: focusErrorMessage(res.data) };
    }

    const d = res.data;
    await withTenant(tenantId, (tx) =>
      tx.fiscalConfig.update({
        where: { tenantId },
        data: {
          focusEmpresaId: d.id ?? empresaId ?? cfg.focusEmpresaId,
          // O PUT às vezes não retorna tokens: cai pros já existentes / salvos.
          focusTokenHomolog: d.token_homologacao ?? existingHomolog ?? cfg.focusTokenHomolog,
          focusTokenProd: d.token_producao ?? existingProd ?? cfg.focusTokenProd,
          certCnpj: d.certificado_cnpj ?? cfg.certCnpj ?? null,
          certValidoAte: d.certificado_valido_ate ? new Date(d.certificado_valido_ate) : cfg.certValidoAte,
          certStatus: "ok",
          enabled: true,
        },
      }),
    );

    revalidatePath("/fiscal");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
