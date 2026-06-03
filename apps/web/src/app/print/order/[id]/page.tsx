import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { PrintButton } from "./print-button";

interface PrintItem {
  productId?: string;
  name?: string;
  qty?: number;
  priceBrl?: number;
  discountBrl?: number;
  freightBrl?: number;
  lineTotal?: number;
}

function brl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function fmtDate(d: Date | null): string {
  return d ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d) : "—";
}
const PAYMENT_LABELS: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  boleto: "Boleto",
};
const SHIFT_LABELS: Record<string, string> = { morning: "Manhã", afternoon: "Tarde" };

export default async function OrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  const order = await withTenant(tenant.id, (tx) => tx.order.findUnique({ where: { id } }));
  if (!order || order.tenantId !== tenant.id) notFound();

  const items = (Array.isArray(order.items) ? order.items : []) as PrintItem[];
  const lineOf = (it: PrintItem) =>
    Number(it.lineTotal ?? Number(it.priceBrl ?? 0) * Number(it.qty ?? 1));
  const subtotal = items.reduce((s, it) => s + lineOf(it), 0);
  const discount = order.discountBrl != null ? Number(order.discountBrl) : 0;
  const freight = order.freightBrl != null ? Number(order.freightBrl) : 0;
  const brand = tenant.brandColor || "#171717";

  return (
    <main className="mx-auto max-w-2xl bg-white p-8 text-neutral-900 print:max-w-none print:p-2 print:text-[12px]">
      <style>{`
        @page { margin: 8mm; }
        @media print {
          html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <PrintButton />

      {/* Cabeçalho com a logo da loja */}
      <header className="flex items-center justify-between border-b-2 pb-4" style={{ borderColor: brand }}>
        <div className="flex items-center gap-3">
          {tenant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logoUrl} alt="" className="h-14 w-14 rounded object-contain" />
          ) : (
            <div
              className="flex h-14 w-14 items-center justify-center rounded text-xl font-bold text-white"
              style={{ backgroundColor: brand }}
            >
              {(tenant.name.trim()[0] ?? "Z").toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-lg font-bold">{tenant.name}</div>
            {tenant.botConfig?.deliveryCities?.length ? (
              <div className="text-xs text-neutral-500">
                Atende: {tenant.botConfig.deliveryCities.join(", ")}
              </div>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold">Pedido #{order.orderNumber}</div>
          <div className="text-xs text-neutral-500">{fmtDate(order.createdAt)}</div>
        </div>
      </header>

      {/* Cliente */}
      <section className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Cliente</div>
          <div className="mt-1 font-medium">{order.customerName}</div>
          <div>{order.customerPhone}</div>
          {order.customerCpf && <div>CPF/CNPJ: {order.customerCpf}</div>}
          {order.customerEmail && <div>{order.customerEmail}</div>}
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {order.deliveryType === "pickup" ? "Retirada" : "Entrega"}
          </div>
          {order.deliveryType === "pickup" ? (
            <div className="mt-1">Retirada na loja</div>
          ) : (
            <div className="mt-1">{order.customerAddress ?? "—"}</div>
          )}
          {order.deliveryType !== "pickup" && (order.deliveryDate || order.deliveryShift) && (
            <div className="mt-1 text-neutral-600">
              {fmtDate(order.deliveryDate)}
              {order.deliveryShift ? ` · ${SHIFT_LABELS[order.deliveryShift] ?? ""}` : ""}
            </div>
          )}
        </div>
      </section>

      {/* Itens */}
      <table className="mt-5 w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500">
            <th className="py-2">Produto</th>
            <th className="py-2 text-center">Qtd</th>
            <th className="py-2 text-right">Preço</th>
            <th className="py-2 text-right">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} className="border-b border-neutral-100">
              <td className="py-2">{it.name}</td>
              <td className="py-2 text-center">{it.qty}</td>
              <td className="py-2 text-right">{brl(Number(it.priceBrl ?? 0))}</td>
              <td className="py-2 text-right">{brl(lineOf(it))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totais */}
      <section className="mt-4 ml-auto w-full max-w-xs text-sm">
        <div className="flex justify-between py-1">
          <span className="text-neutral-500">Subtotal</span>
          <span>{brl(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between py-1">
            <span className="text-neutral-500">Desconto</span>
            <span>- {brl(discount)}</span>
          </div>
        )}
        {freight > 0 && (
          <div className="flex justify-between py-1">
            <span className="text-neutral-500">Frete</span>
            <span>{brl(freight)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t-2 py-2 text-lg font-bold" style={{ borderColor: brand }}>
          <span>Total</span>
          <span>{brl(Number(order.totalBrl))}</span>
        </div>
        {order.paymentMethod && (
          <div className="mt-1 text-right text-neutral-600">
            {PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}
            {order.paymentMethod === "cartao" && order.installments > 1 ? ` · ${order.installments}x` : ""}
            {order.toReceive ? " · a receber" : ""}
          </div>
        )}
      </section>

      {order.notes && (
        <section className="mt-5 border-t border-neutral-200 pt-3 text-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Observações</div>
          <div className="mt-1">{order.notes}</div>
        </section>
      )}

      {order.sellerName && (
        <div className="mt-6 text-xs text-neutral-400">Vendedor: {order.sellerName}</div>
      )}
    </main>
  );
}
