"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma, withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { emitNota, consultarNota, focusFileUrl, focusErrorMessage } from "@/lib/focus";

async function requireTenantId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Nao autenticado");
  const link = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!link) throw new Error("Voce nao tem loja cadastrada");
  return link.tenantId;
}

export interface EmitResult {
  ok: boolean;
  error?: string;
  status?: string;
  message?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

/** Forma de pagamento (nossa) -> código SEFAZ. */
function payCode(method: string | null | undefined): string {
  switch ((method ?? "").toLowerCase()) {
    case "dinheiro":
      return "01";
    case "credito":
    case "cartao":
      return "03";
    case "debito":
      return "04";
    case "boleto":
      return "15";
    case "pix":
      return "17";
    default:
      return "99";
  }
}

interface OrderItemJson {
  productId?: string;
  name?: string;
  kind?: string;
  qty?: number;
  lineTotal?: number;
}
interface FiscalItem {
  numero_item: number;
  codigo_produto: string;
  descricao: string;
  codigo_ncm: string;
  cfop: string;
  unidade_comercial: string;
  quantidade_comercial: number;
  unidade_tributavel: string;
  quantidade_tributavel: number;
  valor_unitario_comercial: number;
  valor_unitario_tributavel: number;
  valor_bruto: number;
  icms_origem: string;
  icms_situacao_tributaria: string;
}

/**
 * Monta os itens da nota a partir dos itens do pedido, DESMEMBRANDO kits nos
 * componentes (o valor do kit é rateado entre os componentes pelo preço deles).
 * Retorna { items } ou { error } (ex.: produto sem NCM).
 */
async function buildItems(
  tx: Parameters<Parameters<typeof withTenant>[1]>[0],
  orderItems: OrderItemJson[],
  cfop: string,
  csosn: string,
): Promise<{ items?: FiscalItem[]; error?: string }> {
  const ids = orderItems.map((i) => i.productId).filter((x): x is string => !!x);
  const kitRows = await tx.productKitItem.findMany({
    where: { kitId: { in: ids } },
    include: { component: { select: { id: true, name: true, fiscalName: true, ncm: true, origem: true, priceBrl: true } } },
  });
  const compIds = kitRows.map((k) => k.componentId);
  const prods = await tx.product.findMany({
    where: { id: { in: [...ids, ...compIds] } },
    select: { id: true, name: true, fiscalName: true, ncm: true, origem: true, kind: true },
  });
  const pmap = new Map(prods.map((p) => [p.id, p]));

  const items: FiscalItem[] = [];
  const missingNcm: string[] = [];
  let n = 1;

  const pushItem = (
    prod: { id: string; name: string; fiscalName: string | null; ncm: string | null; origem: string | null },
    qty: number,
    valorBruto: number,
  ) => {
    const ncm = digits(prod.ncm);
    if (ncm.length !== 8) {
      missingNcm.push(prod.name);
      return;
    }
    const q = qty > 0 ? qty : 1;
    const unit = round2(valorBruto / q);
    items.push({
      numero_item: n++,
      codigo_produto: prod.id.slice(0, 12),
      descricao: (prod.fiscalName || prod.name).slice(0, 120),
      codigo_ncm: ncm,
      cfop,
      unidade_comercial: "UN",
      quantidade_comercial: q,
      unidade_tributavel: "UN",
      quantidade_tributavel: q,
      valor_unitario_comercial: unit,
      valor_unitario_tributavel: unit,
      valor_bruto: round2(valorBruto),
      icms_origem: prod.origem || "0",
      icms_situacao_tributaria: csosn,
    });
  };

  for (const it of orderItems) {
    if (!it.productId) continue;
    const prod = pmap.get(it.productId);
    if (!prod) continue;
    const qty = Number(it.qty) || 1;
    const total = Number(it.lineTotal) || 0;

    if (prod.kind !== "kit") {
      pushItem(prod, qty, total);
      continue;
    }
    // Kit: rateia o valor entre os componentes pelo peso (preço * qtd).
    const comps = kitRows.filter((k) => k.kitId === it.productId);
    if (comps.length === 0) {
      pushItem(prod, qty, total); // sem composição -> trata como simples
      continue;
    }
    const weights = comps.map((c) => Number(c.component.priceBrl) * c.qty);
    const wsum = weights.reduce((s, w) => s + w, 0) || comps.length;
    let allocated = 0;
    comps.forEach((c, idx) => {
      const isLast = idx === comps.length - 1;
      const share = isLast ? round2(total - allocated) : round2((total * weights[idx]) / wsum);
      allocated = round2(allocated + share);
      pushItem(c.component, c.qty * qty, share);
    });
  }

  if (missingNcm.length) {
    return { error: `Defina o NCM (8 dígitos) destes produtos antes de emitir: ${[...new Set(missingNcm)].join(", ")}.` };
  }
  if (items.length === 0) return { error: "Pedido sem itens válidos pra nota." };
  return { items };
}

/** Emite uma nota (por enquanto NFC-e) pro pedido e consulta o status. */
export async function emitNotaAction(orderId: string, model: "nfce" | "nfe"): Promise<EmitResult> {
  try {
    const tenantId = await requireTenantId();

    const cfg = await withTenant(tenantId, (tx) => tx.fiscalConfig.findUnique({ where: { tenantId } }));
    if (!cfg || !cfg.enabled) return { ok: false, error: "Configure e ative o Fiscal primeiro (aba Fiscal)." };
    if (model === "nfce" && !cfg.habilitaNfce) return { ok: false, error: "NFC-e não habilitada na config fiscal." };
    if (model === "nfe" && !cfg.habilitaNfe) return { ok: false, error: "NF-e não habilitada na config fiscal." };

    const token = cfg.ambiente === "producao" ? cfg.focusTokenProd : cfg.focusTokenHomolog;
    if (!token) return { ok: false, error: `Token da empresa (${cfg.ambiente}) ausente. Reenvie/vincule o certificado.` };

    const cfop = cfg.cfopPadrao?.trim() || "5102";
    const csosn = cfg.csosnPadrao?.trim() || "102";

    const built = await withTenant(tenantId, async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) return { error: "Pedido não encontrado." as string };
      const orderItems = (Array.isArray(order.items) ? order.items : []) as OrderItemJson[];
      const r = await buildItems(tx, orderItems, cfop, csosn);
      if (r.error) return { error: r.error };
      return { order, items: r.items! };
    });
    if ("error" in built) return { ok: false, error: built.error };
    const { order, items } = built;

    const total = Number(order.totalBrl);
    const ref = `o${order.orderNumber}-${model}-${Date.now().toString(36)}`;

    // Destinatário: só inclui se houver CPF (11) ou CNPJ (14). Sem documento =
    // NFC-e anônima (não pode mandar nome sozinho — SEFAZ rejeita).
    const doc = digits(order.customerCpf);
    const dest: Record<string, unknown> = {};
    if (doc.length === 11) {
      dest.cpf_destinatario = doc;
      if (order.customerName) dest.nome_destinatario = order.customerName;
    } else if (doc.length === 14) {
      dest.cnpj_destinatario = doc;
      if (order.customerName) dest.nome_destinatario = order.customerName;
    }

    const payload: Record<string, unknown> = {
      cnpj_emitente: cfg.cnpj,
      natureza_operacao: "VENDA AO CONSUMIDOR",
      data_emissao: new Date().toISOString(),
      presenca_comprador: order.deliveryType === "delivery" ? "4" : "1",
      modalidade_frete: "9",
      local_destino: "1",
      ...dest,
      formas_pagamento: [{ forma_pagamento: payCode(order.paymentMethod), valor_pagamento: round2(total) }],
      items,
    };

    const res = await emitNota(model, cfg.ambiente, token, ref, payload);
    if (!res.ok && res.status !== 422) {
      // 422 = nota rejeitada mas processada (tem corpo com erro útil); outros = falha real.
      return { ok: false, error: focusErrorMessage(res.data) };
    }

    // Marca como processando e já consulta (o Focus pode autorizar na hora ou async).
    await withTenant(tenantId, (tx) =>
      tx.order.update({
        where: { id: orderId },
        data: { fiscalModel: model, fiscalRef: ref, fiscalStatus: res.data.status ?? "processando" },
      }),
    );

    const consulta = await consultarNota(model, cfg.ambiente, token, ref);
    const d = consulta.ok ? consulta.data : res.data;
    const danfe = focusFileUrl(cfg.ambiente, d.caminho_danfe);
    const xml = focusFileUrl(cfg.ambiente, d.caminho_xml_nota_fiscal);
    const message = d.mensagem_sefaz || (d.erros?.map((e) => e.mensagem).filter(Boolean).join("; ")) || d.mensagem || null;
    // Sem status mas com erro/mensagem = rejeitada (não ficar "processando" eterno).
    const finalStatus = d.status ?? (d.erros?.length || (!res.ok && message) ? "erro_autorizacao" : "processando");

    await withTenant(tenantId, (tx) =>
      tx.order.update({
        where: { id: orderId },
        data: {
          fiscalStatus: finalStatus,
          fiscalChave: d.chave_nfe ?? null,
          fiscalNumero: d.numero ?? null,
          fiscalDanfeUrl: danfe,
          fiscalXmlUrl: xml,
          fiscalMessage: message,
          fiscalAt: new Date(),
        },
      }),
    );

    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/orders");
    return { ok: true, status: finalStatus, message: message ?? undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

/** Reconsulta o status de uma nota já enviada. */
export async function refreshNotaAction(orderId: string): Promise<EmitResult> {
  try {
    const tenantId = await requireTenantId();
    const cfg = await withTenant(tenantId, (tx) => tx.fiscalConfig.findUnique({ where: { tenantId } }));
    if (!cfg) return { ok: false, error: "Fiscal não configurado." };
    const order = await withTenant(tenantId, (tx) =>
      tx.order.findUnique({ where: { id: orderId }, select: { fiscalModel: true, fiscalRef: true } }),
    );
    if (!order?.fiscalRef || !order.fiscalModel) return { ok: false, error: "Pedido sem nota emitida." };
    const token = cfg.ambiente === "producao" ? cfg.focusTokenProd : cfg.focusTokenHomolog;
    if (!token) return { ok: false, error: "Token da empresa ausente." };

    const model = order.fiscalModel as "nfce" | "nfe";
    const consulta = await consultarNota(model, cfg.ambiente, token, order.fiscalRef);
    if (!consulta.ok && consulta.status >= 500) return { ok: false, error: focusErrorMessage(consulta.data) };
    const d = consulta.data;
    const message = d.mensagem_sefaz || d.mensagem || null;

    await withTenant(tenantId, (tx) =>
      tx.order.update({
        where: { id: orderId },
        data: {
          fiscalStatus: d.status ?? "processando",
          fiscalChave: d.chave_nfe ?? null,
          fiscalNumero: d.numero ?? null,
          fiscalDanfeUrl: focusFileUrl(cfg.ambiente, d.caminho_danfe),
          fiscalXmlUrl: focusFileUrl(cfg.ambiente, d.caminho_xml_nota_fiscal),
          fiscalMessage: message,
        },
      }),
    );
    revalidatePath(`/orders/${orderId}`);
    return { ok: true, status: d.status, message: message ?? undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
