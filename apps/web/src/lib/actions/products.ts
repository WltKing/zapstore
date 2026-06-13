"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma, withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { priceFromCostMargin } from "@/lib/pricing";
import { requireManagementPin, getCurrentRole } from "@/lib/management";

export interface ProductInput {
  name: string;
  fiscalName?: string;
  description?: string;
  category?: string;
  kind: string; // "simple" | "kit"
  priceBrl: number;
  costBrl?: number | null;
  imageUrl?: string;
  realImageUrl?: string;
  stock: number;
  lowStockThreshold: number;
  ncm?: string;
  cest?: string;
  cfopEntrada?: string;
  origem?: string;
  active: boolean;
  kitItems?: { componentId: string; qty: number }[];
}

/** Monta as linhas de composição de um kit (vazio se não for kit). */
function kitRows(tenantId: string, kitId: string, input: ProductInput) {
  if (input.kind !== "kit" || !input.kitItems?.length) return [];
  return input.kitItems
    .filter((i) => i.componentId && i.componentId !== kitId && Number.isInteger(i.qty) && i.qty > 0)
    .map((i) => ({ tenantId, kitId, componentId: i.componentId, qty: i.qty }));
}

export interface ActionResult {
  ok: boolean;
  error?: string;
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

function validateProduct(input: ProductInput): string | null {
  if (!input.name.trim()) return "Informe o nome do produto.";
  if (Number.isNaN(input.priceBrl) || input.priceBrl < 0) return "Preco invalido.";
  if (input.costBrl != null && (Number.isNaN(input.costBrl) || input.costBrl < 0)) return "Custo invalido.";
  if (!Number.isInteger(input.stock) || input.stock < 0) return "Estoque invalido.";
  if (!Number.isInteger(input.lowStockThreshold) || input.lowStockThreshold < 0)
    return "Limite de estoque baixo invalido.";
  return null;
}

export async function createProductAction(input: ProductInput): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    const err = validateProduct(input);
    if (err) return { ok: false, error: err };

    await withTenant(tenantId, async (tx) => {
      const product = await tx.product.create({
        data: {
          tenantId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          fiscalName: input.fiscalName?.trim() || null,
          category: input.category?.trim() || null,
          kind: input.kind === "kit" ? "kit" : "simple",
          priceBrl: input.priceBrl,
          costBrl: input.costBrl != null && !Number.isNaN(input.costBrl) ? input.costBrl : null,
          imageUrl: input.imageUrl?.trim() || null,
          realImageUrl: input.realImageUrl?.trim() || null,
          stock: input.stock,
          lowStockThreshold: input.lowStockThreshold,
          ncm: input.ncm?.trim() || null,
          cest: input.cest?.trim() || null,
          cfopEntrada: input.cfopEntrada?.trim() || null,
          origem: input.origem?.trim() || null,
          active: input.active,
        },
      });
      const rows = kitRows(tenantId, product.id, input);
      if (rows.length) await tx.productKitItem.createMany({ data: rows });
    });

    revalidatePath("/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function updateProductAction(id: string, input: ProductInput, pin?: string): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    const guard = await requireManagementPin(tenantId, pin);
    if (!guard.ok) return guard;
    const err = validateProduct(input);
    if (err) return { ok: false, error: err };

    // Custo é informação do DONO: só ADMIN pode alterá-lo. Gerente edita o resto
    // sem tocar no custo (não vem no formulário dele — preserva o que está salvo).
    const isOwner = (await getCurrentRole(tenantId)) === "ADMIN";

    await withTenant(tenantId, async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          name: input.name.trim(),
          description: input.description?.trim() || null,
          fiscalName: input.fiscalName?.trim() || null,
          category: input.category?.trim() || null,
          kind: input.kind === "kit" ? "kit" : "simple",
          priceBrl: input.priceBrl,
          ...(isOwner
            ? { costBrl: input.costBrl != null && !Number.isNaN(input.costBrl) ? input.costBrl : null }
            : {}),
          imageUrl: input.imageUrl?.trim() || null,
          realImageUrl: input.realImageUrl?.trim() || null,
          stock: input.stock,
          lowStockThreshold: input.lowStockThreshold,
          ncm: input.ncm?.trim() || null,
          cest: input.cest?.trim() || null,
          cfopEntrada: input.cfopEntrada?.trim() || null,
          origem: input.origem?.trim() || null,
          active: input.active,
        },
      });
      // Recompõe os itens do kit (substitui os existentes).
      await tx.productKitItem.deleteMany({ where: { kitId: id } });
      const rows = kitRows(tenantId, id, input);
      if (rows.length) await tx.productKitItem.createMany({ data: rows });
    });

    revalidatePath("/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function deleteProductAction(id: string, pin?: string): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    const guard = await requireManagementPin(tenantId, pin, { deletion: true });
    if (!guard.ok) return guard;
    await withTenant(tenantId, async (tx) => {
      await tx.product.delete({ where: { id } });
    });
    revalidatePath("/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

/** Exclui vários produtos de uma vez (seleção em massa). */
export async function deleteProductsAction(
  ids: string[],
  pin?: string,
): Promise<ActionResult & { deleted?: number }> {
  try {
    const tenantId = await requireTenantId();
    const guard = await requireManagementPin(tenantId, pin, { deletion: true });
    if (!guard.ok) return guard;
    if (!ids.length) return { ok: false, error: "Nenhum produto selecionado." };
    const r = await withTenant(tenantId, (tx) =>
      tx.product.deleteMany({ where: { id: { in: ids } } }),
    );
    revalidatePath("/products");
    return { ok: true, deleted: r.count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

/** Recalcula o preço de venda de vários produtos pela margem (% sobre a venda),
 * a partir do CUSTO de cada um. Produtos sem custo são ignorados (skipped). */
export async function applyMarginToProductsAction(
  ids: string[],
  marginPct: number,
  pin?: string,
): Promise<ActionResult & { updated?: number; skipped?: number }> {
  try {
    const tenantId = await requireTenantId();
    const guard = await requireManagementPin(tenantId, pin);
    if (!guard.ok) return guard;
    if (!ids.length) return { ok: false, error: "Nenhum produto selecionado." };
    if (!Number.isFinite(marginPct) || marginPct < 0 || marginPct >= 100)
      return { ok: false, error: "Margem inválida — use um valor entre 0 e 99." };

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { roundTo90: true },
    });
    const round = tenant?.roundTo90 ?? false;

    const { updated, skipped } = await withTenant(tenantId, async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: ids } },
        select: { id: true, costBrl: true },
      });
      let updated = 0;
      let skipped = 0;
      for (const p of products) {
        const price = priceFromCostMargin(
          p.costBrl != null ? Number(p.costBrl) : null,
          marginPct,
          round,
        );
        if (price == null) {
          skipped++;
          continue;
        }
        await tx.product.update({ where: { id: p.id }, data: { priceBrl: price } });
        updated++;
      }
      return { updated, skipped };
    });

    revalidatePath("/products");
    return { ok: true, updated, skipped };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function toggleProductAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    // Ativar/desativar produto é decisão de gestão: só dono ou gerente.
    const role = await getCurrentRole(tenantId);
    if (role !== "ADMIN" && role !== "MANAGER") {
      return { ok: false, error: "Só o dono ou o gerente podem ativar/desativar produtos." };
    }
    await withTenant(tenantId, async (tx) => {
      await tx.product.update({ where: { id }, data: { active } });
    });
    revalidatePath("/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
