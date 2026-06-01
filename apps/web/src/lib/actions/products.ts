"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma, withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";

export interface ProductInput {
  name: string;
  description?: string;
  category?: string;
  priceBrl: number;
  costBrl?: number | null;
  imageUrl?: string;
  stock: number;
  lowStockThreshold: number;
  active: boolean;
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
      await tx.product.create({
        data: {
          tenantId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          category: input.category?.trim() || null,
          priceBrl: input.priceBrl,
          costBrl: input.costBrl != null && !Number.isNaN(input.costBrl) ? input.costBrl : null,
          imageUrl: input.imageUrl?.trim() || null,
          stock: input.stock,
          lowStockThreshold: input.lowStockThreshold,
          active: input.active,
        },
      });
    });

    revalidatePath("/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function updateProductAction(id: string, input: ProductInput): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    const err = validateProduct(input);
    if (err) return { ok: false, error: err };

    await withTenant(tenantId, async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          name: input.name.trim(),
          description: input.description?.trim() || null,
          category: input.category?.trim() || null,
          priceBrl: input.priceBrl,
          costBrl: input.costBrl != null && !Number.isNaN(input.costBrl) ? input.costBrl : null,
          imageUrl: input.imageUrl?.trim() || null,
          stock: input.stock,
          lowStockThreshold: input.lowStockThreshold,
          active: input.active,
        },
      });
    });

    revalidatePath("/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    await withTenant(tenantId, async (tx) => {
      await tx.product.delete({ where: { id } });
    });
    revalidatePath("/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function toggleProductAction(id: string, active: boolean): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    await withTenant(tenantId, async (tx) => {
      await tx.product.update({ where: { id }, data: { active } });
    });
    revalidatePath("/products");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}
