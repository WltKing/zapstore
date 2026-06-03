"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma, withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";

/** Uma decisão por item da NF, montada na tela de conferência. */
export interface NfeImportLine {
  action: "create" | "link" | "skip";
  linkProductId?: string | null; // quando action = "link"
  updateCost?: boolean; // quando "link": atualiza o custo também
  // Dados do produto (vindos do XML, editáveis na tela)
  name: string;
  fiscalName: string;
  ncm?: string;
  cfopEntrada?: string;
  origem?: string;
  qty: number; // quantidade a somar no estoque
  unitCost: number; // custo unitário (vUnCom)
  priceBrl?: number; // preço de venda (só p/ "create")
}

export interface NfeImportResult {
  ok: boolean;
  error?: string;
  created?: number;
  updated?: number;
}

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

/**
 * Aplica a importação de uma NF de entrada: cria produtos novos e soma estoque
 * nos vinculados. O parse do XML acontece no navegador (DOMParser) — aqui só
 * recebemos as decisões já conferidas pelo lojista e gravamos no banco.
 */
export async function importNfeAction(lines: NfeImportLine[]): Promise<NfeImportResult> {
  try {
    const tenantId = await requireTenantId();
    if (!Array.isArray(lines) || lines.length === 0) {
      return { ok: false, error: "Nenhum item para importar." };
    }

    let created = 0;
    let updated = 0;

    await withTenant(tenantId, async (tx) => {
      for (const line of lines) {
        if (line.action === "skip") continue;

        const qty = Number.isFinite(line.qty) ? Math.max(0, Math.round(line.qty)) : 0;
        const unitCost =
          line.unitCost != null && Number.isFinite(line.unitCost) ? line.unitCost : null;

        if (line.action === "link") {
          if (!line.linkProductId) continue;
          await tx.product.update({
            where: { id: line.linkProductId },
            data: {
              stock: { increment: qty },
              ...(line.updateCost && unitCost != null ? { costBrl: unitCost } : {}),
            },
          });
          updated++;
        } else if (line.action === "create") {
          const name = line.name.trim();
          if (!name) continue;
          await tx.product.create({
            data: {
              tenantId,
              name,
              fiscalName: line.fiscalName?.trim() || name,
              kind: "simple",
              priceBrl: line.priceBrl != null && Number.isFinite(line.priceBrl) ? line.priceBrl : 0,
              costBrl: unitCost,
              stock: qty,
              ncm: line.ncm?.trim() || null,
              cfopEntrada: line.cfopEntrada?.trim() || null,
              origem: line.origem?.trim() || null,
              active: true,
            },
          });
          created++;
        }
      }
    });

    revalidatePath("/products");
    return { ok: true, created, updated };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
