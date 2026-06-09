"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma, withTenant, type AppointmentStatus } from "@zapstore/db";
import { auth } from "@/lib/auth";

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

export interface ActionResult {
  ok: boolean;
  error?: string;
}

function fail(e: unknown): ActionResult {
  return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
}

// ============================================================
// PROFISSIONAIS
// ============================================================

export interface ProfessionalInput {
  name: string;
  active: boolean;
}

export async function createProfessionalAction(input: ProfessionalInput): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    if (!input.name.trim()) return { ok: false, error: "Informe o nome do profissional." };
    await withTenant(tenantId, async (tx) => {
      await tx.professional.create({
        data: { tenantId, name: input.name.trim(), active: input.active },
      });
    });
    revalidatePath("/scheduling");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateProfessionalAction(
  id: string,
  input: ProfessionalInput,
): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    if (!input.name.trim()) return { ok: false, error: "Informe o nome do profissional." };
    await withTenant(tenantId, async (tx) => {
      await tx.professional.update({
        where: { id },
        data: { name: input.name.trim(), active: input.active },
      });
    });
    revalidatePath("/scheduling");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteProfessionalAction(id: string): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    await withTenant(tenantId, async (tx) => {
      await tx.professional.delete({ where: { id } });
    });
    revalidatePath("/scheduling");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ============================================================
// SERVIÇOS
// ============================================================

export interface ServiceInput {
  name: string;
  durationMin: number;
  priceBrl: number;
  active: boolean;
}

function validateService(input: ServiceInput): string | null {
  if (!input.name.trim()) return "Informe o nome do serviço.";
  if (!Number.isInteger(input.durationMin) || input.durationMin <= 0) return "Duração inválida.";
  if (Number.isNaN(input.priceBrl) || input.priceBrl < 0) return "Preço inválido.";
  return null;
}

export async function createServiceAction(input: ServiceInput): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    const err = validateService(input);
    if (err) return { ok: false, error: err };
    await withTenant(tenantId, async (tx) => {
      await tx.service.create({
        data: {
          tenantId,
          name: input.name.trim(),
          durationMin: input.durationMin,
          priceBrl: input.priceBrl,
          active: input.active,
        },
      });
    });
    revalidatePath("/scheduling");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateServiceAction(id: string, input: ServiceInput): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    const err = validateService(input);
    if (err) return { ok: false, error: err };
    await withTenant(tenantId, async (tx) => {
      await tx.service.update({
        where: { id },
        data: {
          name: input.name.trim(),
          durationMin: input.durationMin,
          priceBrl: input.priceBrl,
          active: input.active,
        },
      });
    });
    revalidatePath("/scheduling");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteServiceAction(id: string): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    await withTenant(tenantId, async (tx) => {
      await tx.service.delete({ where: { id } });
    });
    revalidatePath("/scheduling");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ============================================================
// AGENDAMENTOS
// ============================================================

export interface AppointmentInput {
  professionalId?: string | null;
  serviceId?: string | null;
  serviceName?: string;
  customerName: string;
  customerPhone: string;
  scheduledFor: string; // ISO (datetime-local)
  notes?: string;
}

export async function createAppointmentAction(input: AppointmentInput): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    if (!input.customerName.trim()) return { ok: false, error: "Informe o nome do cliente." };
    if (!input.customerPhone.replace(/\D/g, "")) return { ok: false, error: "Informe o telefone." };
    if (!input.scheduledFor) return { ok: false, error: "Informe a data e hora." };
    // datetime-local não tem fuso; o servidor roda em UTC. Interpretar como São Paulo (−03:00),
    // senão 11:00 vira 08:00. (Brasil sem horário de verão = offset fixo.)
    const raw = input.scheduledFor;
    const when = new Date(/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw}-03:00`);
    if (Number.isNaN(when.getTime())) return { ok: false, error: "Data/hora inválida." };

    await withTenant(tenantId, async (tx) => {
      // Snapshot do serviço (se escolhido um cadastrado).
      let serviceName = input.serviceName?.trim() || "Atendimento";
      let durationMin = 30;
      let priceBrl = 0;
      if (input.serviceId) {
        const svc = await tx.service.findUnique({ where: { id: input.serviceId } });
        if (!svc) throw new Error("Serviço inválido.");
        serviceName = svc.name;
        durationMin = svc.durationMin;
        priceBrl = Number(svc.priceBrl);
      }
      await tx.appointment.create({
        data: {
          tenantId,
          professionalId: input.professionalId || null,
          serviceId: input.serviceId || null,
          serviceName,
          customerName: input.customerName.trim(),
          customerPhone: input.customerPhone.replace(/\D/g, ""),
          scheduledFor: when,
          durationMin,
          priceBrl,
          notes: input.notes?.trim() || null,
        },
      });
    });

    revalidatePath("/scheduling");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateAppointmentStatusAction(
  id: string,
  status: AppointmentStatus,
): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    await withTenant(tenantId, async (tx) => {
      await tx.appointment.update({ where: { id }, data: { status } });
    });
    revalidatePath("/scheduling");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Conclui o atendimento E gera a venda (entra no faturamento/caixa).
 * Atendimento realizado = venda: o serviço vira item, o profissional vira vendedor. */
export async function completeAppointmentAction(
  id: string,
  paymentMethod: string,
  installments: number,
): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    const res = await withTenant(tenantId, async (tx): Promise<ActionResult> => {
      const appt = await tx.appointment.findUnique({ where: { id }, include: { professional: true } });
      if (!appt) return { ok: false, error: "Agendamento não encontrado." };

      // Já concluído com venda: só garante o status (evita venda duplicada).
      if (appt.orderId) {
        await tx.appointment.update({ where: { id }, data: { status: "DONE" } });
        return { ok: true };
      }

      const price = Number(appt.priceBrl);
      const last = await tx.order.findFirst({
        where: { tenantId },
        orderBy: { orderNumber: "desc" },
        select: { orderNumber: true },
      });
      const orderNumber = (last?.orderNumber ?? 0) + 1;

      const order = await tx.order.create({
        data: {
          tenantId,
          orderNumber,
          customerName: appt.customerName,
          customerPhone: appt.customerPhone,
          status: "DELIVERED", // serviço realizado
          channel: "presencial",
          sellerName: appt.professional?.name ?? null,
          deliveryType: "pickup", // serviço não é entrega — não entra em rota/entregas
          items: [{ name: appt.serviceName, qty: 1, priceBrl: price, lineTotal: price }],
          totalBrl: price,
          paymentMethod,
          installments: installments > 0 ? installments : 1,
        },
      });

      // Cliente atendido fica salvo em Clientes (CRM).
      const phone = appt.customerPhone.replace(/\D/g, "");
      if (phone) {
        await tx.customer.upsert({
          where: { tenantId_phone: { tenantId, phone } },
          create: { tenantId, phone, name: appt.customerName },
          update: { name: appt.customerName },
        });
      }

      await tx.appointment.update({ where: { id }, data: { status: "DONE", orderId: order.id } });
      return { ok: true };
    });

    revalidatePath("/scheduling");
    revalidatePath("/dashboard");
    revalidatePath("/cashflow");
    revalidatePath("/orders");
    return res;
  } catch (e) {
    return fail(e);
  }
}

export async function deleteAppointmentAction(id: string): Promise<ActionResult> {
  try {
    const tenantId = await requireTenantId();
    await withTenant(tenantId, async (tx) => {
      await tx.appointment.delete({ where: { id } });
    });
    revalidatePath("/scheduling");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
