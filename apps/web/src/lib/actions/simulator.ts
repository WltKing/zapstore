"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma, withTenant } from "@zapstore/db";
import { processConversationTurn } from "@zapstore/engine";
import { auth } from "@/lib/auth";

export interface SimulatorMessage {
  role: "user" | "assistant";
  content: string;
  at: string; // ISO
}

async function requireContext() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Nao autenticado");
  const link = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!link) throw new Error("Voce nao tem loja cadastrada");
  return { userId: session.user.id, tenantId: link.tenantId };
}

function simulatorPhone(userId: string): string {
  return `sim:${userId}`;
}

export interface SendResult {
  ok: boolean;
  error?: string;
  reply?: string;
  toolMessages?: string[];
  blocked?: string;
}

export async function sendSimulatorMessage(text: string): Promise<SendResult> {
  try {
    const { userId, tenantId } = await requireContext();
    const result = await processConversationTurn({
      tenantId,
      customerPhone: simulatorPhone(userId),
      customerName: "Simulador",
      text,
    });
    revalidatePath("/simulator");
    return {
      ok: true,
      reply: result.replyText,
      toolMessages: result.toolExecutions.map((t) =>
        t.ok
          ? `Tool ${t.name} executou OK: ${JSON.stringify(t.result)}`
          : `Tool ${t.name} falhou: ${t.error}`,
      ),
      blocked: result.blocked,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function resetSimulator(): Promise<{ ok: boolean }> {
  const { userId, tenantId } = await requireContext();
  await withTenant(tenantId, async (tx) => {
    const conv = await tx.conversation.findUnique({
      where: { tenantId_customerPhone: { tenantId, customerPhone: simulatorPhone(userId) } },
    });
    if (conv) {
      await tx.message.deleteMany({ where: { conversationId: conv.id } });
      await tx.conversation.delete({ where: { id: conv.id } });
    }
  });
  revalidatePath("/simulator");
  return { ok: true };
}

export async function loadSimulatorHistory(): Promise<SimulatorMessage[]> {
  const { userId, tenantId } = await requireContext();
  const rows = await withTenant(tenantId, async (tx) => {
    const conv = await tx.conversation.findUnique({
      where: { tenantId_customerPhone: { tenantId, customerPhone: simulatorPhone(userId) } },
    });
    if (!conv) return [];
    return tx.message.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
  });
  return rows.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
    at: m.createdAt.toISOString(),
  }));
}
