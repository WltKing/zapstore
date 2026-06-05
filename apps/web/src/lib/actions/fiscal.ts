"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma, withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import {
  createEmpresa,
  updateEmpresa,
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
}

function onlyDigits(s: string | undefined): string {
  return (s ?? "").replace(/\D/g, "");
}

/** Salva os dados da empresa/ambiente (sem mexer no certificado). */
export async function saveFiscalConfigAction(input: FiscalConfigInput): Promise<ActionResult> {
  try {
    const tenantId = await requireAdminTenant();
    const cnpj = onlyDigits(input.cnpj);
    if (cnpj.length !== 14) return { ok: false, error: "CNPJ inválido (14 dígitos)." };
    if (!input.razaoSocial.trim()) return { ok: false, error: "Informe a razão social." };
    const ambiente = input.ambiente === "producao" ? "producao" : "homologacao";

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
    };

    await withTenant(tenantId, async (tx) => {
      await tx.fiscalConfig.upsert({
        where: { tenantId },
        create: { tenantId, ...data },
        update: data,
      });
    });

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

    const res = cfg.focusEmpresaId
      ? await updateEmpresa(cfg.focusEmpresaId, payload)
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
          focusEmpresaId: d.id ?? cfg.focusEmpresaId,
          focusTokenHomolog: d.token_homologacao ?? cfg.focusTokenHomolog,
          focusTokenProd: d.token_producao ?? cfg.focusTokenProd,
          certCnpj: d.certificado_cnpj ?? null,
          certValidoAte: d.certificado_valido_ate ? new Date(d.certificado_valido_ate) : null,
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
