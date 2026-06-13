"use client";

import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, Plus, CheckCircle2, X } from "lucide-react";
import { createOrderAction, updateOrderAction, type OrderInput } from "@/lib/actions/orders";
import { lookupCepAction, searchCepAction } from "@/lib/actions/cep";
import { PAYMENT_OPTIONS, paymentHasInstallments } from "@/lib/payments";
import {
  validateOrderInput,
  validateDeliverySchedule,
  validateDeliveryAvailability,
  capacityFor,
  nowInSp,
  DEFAULT_CUTOFFS,
  type DeliveryCutoffs,
  type WeeklyCapacity,
} from "@/lib/order-validation";
import { maskPhone, maskCep, maskCpfCnpj } from "@/lib/format";
import { callWithPin } from "@/lib/with-pin";

function Req() {
  return <span className="text-red-500" aria-hidden>{" *"}</span>;
}

export interface ProductOpt {
  id: string;
  name: string;
  priceBrl: number;
}

const PAYMENTS = PAYMENT_OPTIONS;

const inputClass =
  "mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

function formatBrl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

export function blankOrder(): OrderInput {
  return {
    customerName: "",
    customerPhone: "",
    customerCpf: "",
    customerEmail: "",
    cep: "",
    street: "",
    streetNumber: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    channel: "presencial",
    sellerName: "",
    invoiceType: "none",
    toReceive: false,
    deliveryType: "delivery",
    deliveryDate: "",
    deliveryShift: "",
    paymentMethod: "",
    installments: 1,
    notes: "",
    items: [{ productId: "", qty: 1 }],
  };
}

export function OrderForm({
  products,
  sellers,
  initial,
  orderId,
  orderNumber,
  fiscalSlot,
  cutoffs = DEFAULT_CUTOFFS,
  weeklyCapacity = null,
}: {
  products: ProductOpt[];
  sellers: string[];
  initial: OrderInput;
  orderId?: string;
  orderNumber?: number;
  fiscalSlot?: ReactNode;
  cutoffs?: DeliveryCutoffs;
  weeklyCapacity?: WeeklyCapacity | null;
}) {
  const router = useRouter();
  // Aplica as máscaras nos valores que vêm crus do banco (só dígitos).
  const [form, setForm] = useState<OrderInput>(() => ({
    ...initial,
    customerPhone: maskPhone(initial.customerPhone),
    customerCpf: maskCpfCnpj(initial.customerCpf ?? ""),
    cep: maskCep(initial.cep ?? ""),
  }));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [isPending, startTransition] = useTransition();

  const set = (patch: Partial<OrderInput>) => {
    setDirty(true);
    setForm((f) => ({ ...f, ...patch }));
  };
  const priceOf = (id: string) => products.find((p) => p.id === id)?.priceBrl ?? 0;

  const setItem = (i: number, patch: Partial<OrderInput["items"][number]>) => {
    setDirty(true);
    setForm((f) => ({ ...f, items: f.items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }));
  };
  const addItem = () => {
    setDirty(true);
    setForm((f) => ({ ...f, items: [...f.items, { productId: "", qty: 1 }] }));
  };
  const removeItem = (i: number) => {
    setDirty(true);
    setForm((f) => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  };

  // Sai do form descartando alterações; confirma se houver mudança não salva.
  const discard = () => {
    if (!dirty || confirm("Sair sem salvar? As alterações não salvas serão perdidas.")) {
      router.push("/orders");
    }
  };

  const lineTotal = (it: OrderInput["items"][number]) =>
    it.qty * priceOf(it.productId) - (it.discountBrl ?? 0) + (it.freightBrl ?? 0);

  const total = useMemo(
    () =>
      form.items.reduce((s, it) => s + lineTotal(it), 0) -
      (form.discountBrl ?? 0) +
      (form.freightBrl ?? 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form.items, form.discountBrl, form.freightBrl],
  );

  const lastCep = useRef("");

  // CEP -> endereço (automático ao completar 8 dígitos, ou pelo botão).
  const doLookupCep = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length !== 8 || digits === lastCep.current) return;
    lastCep.current = digits;
    setCepLoading(true);
    startTransition(async () => {
      const r = await lookupCepAction(digits);
      setCepLoading(false);
      if (!r.ok || !r.data) {
        setError(r.error ?? "CEP não encontrado.");
        return;
      }
      setError(null);
      set({
        street: r.data.street || form.street,
        neighborhood: r.data.neighborhood || form.neighborhood,
        city: r.data.city,
        state: r.data.state,
      });
    });
  };

  // Endereço -> CEP (quando não tem CEP e rua+cidade+UF estão preenchidos).
  const doReverseCep = () => {
    const digits = (form.cep ?? "").replace(/\D/g, "");
    if (digits.length === 8) return;
    if (
      (form.state ?? "").trim().length !== 2 ||
      (form.city ?? "").trim().length < 3 ||
      (form.street ?? "").trim().length < 3
    )
      return;
    startTransition(async () => {
      const r = await searchCepAction(form.state ?? "", form.city ?? "", form.street ?? "");
      if (r.ok && r.data && r.data[0]) {
        lastCep.current = r.data[0].cep;
        set({ cep: r.data[0].cep, neighborhood: r.data[0].neighborhood || form.neighborhood });
      }
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const invalid =
      validateOrderInput(form) ??
      (form.deliveryType !== "pickup"
        ? validateDeliverySchedule(form.deliveryDate, form.deliveryShift, cutoffs) ??
          validateDeliveryAvailability(form.deliveryDate, form.deliveryShift, weeklyCapacity)
        : null);
    if (invalid) {
      setError(invalid);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    startTransition(async () => {
      if (orderId) {
        const r = await callWithPin((pin) => updateOrderAction(orderId, form, pin));
        if (!r.ok) setError(r.error ?? "Erro");
        else {
          setSaved(true);
          router.refresh();
        }
      } else {
        const r = await createOrderAction(form);
        if (!r.ok) setError(r.error ?? "Erro");
        else if (r.orderId) router.push(`/orders/${r.orderId}`);
        else router.push("/orders");
      }
    });
  };

  const isDelivery = form.deliveryType !== "pickup";
  // Agendamento: hoje só até o corte de cada turno (hora de Brasília).
  const sp = nowInSp();
  const isToday = form.deliveryDate === sp.date;
  // Turno indisponível: corte de hoje OU dia/turno sem entrega (capacidade 0).
  const morningOff = !!form.deliveryDate && capacityFor(weeklyCapacity, form.deliveryDate, "morning") === 0;
  const afternoonOff = !!form.deliveryDate && capacityFor(weeklyCapacity, form.deliveryDate, "afternoon") === 0;
  const morningClosed = (isToday && sp.time >= cutoffs.morning) || morningOff;
  const afternoonClosed = (isToday && sp.time >= cutoffs.afternoon) || afternoonOff;
  const needsFiscalAddress = form.invoiceType === "nfe"; // NF-e exige endereço mesmo na retirada
  const showAddress = isDelivery || needsFiscalAddress;
  const isNfe = form.invoiceType === "nfe";

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <a href="/orders" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Pedidos
          </a>
          <h1 className="text-2xl font-bold tracking-tight">
            {orderId ? `Pedido #${orderNumber}` : "Novo pedido"}
          </h1>
        </div>
        <div className="flex gap-2">
          {orderId && (
            <button
              type="button"
              onClick={() =>
                window.open(
                  `/print/order/${orderId}`,
                  "print-popup",
                  "width=480,height=720,menubar=no,toolbar=no",
                )
              }
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              <Printer className="h-[18px] w-[18px]" strokeWidth={2} />
              Imprimir
            </button>
          )}
          <a
            href="/orders/new"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            <Plus className="h-[18px] w-[18px]" strokeWidth={2} />
            Nova venda
          </a>
        </div>
      </header>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {saved && (
        <p className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
          Salvo!
        </p>
      )}

      {/* Cliente */}
      <section className="rounded-2xl bg-white p-5 shadow-card">
        <h2 className="font-semibold">Cliente</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Nome<Req /></label>
            <input required value={form.customerName} onChange={(e) => set({ customerName: e.target.value })} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Telefone<Req /></label>
            <input required inputMode="tel" value={form.customerPhone} onChange={(e) => set({ customerPhone: maskPhone(e.target.value) })} placeholder="(62) 99157-2500" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">
              CPF/CNPJ{isNfe ? <Req /> : " (opcional)"}
            </label>
            <input inputMode="numeric" value={form.customerCpf} onChange={(e) => set({ customerCpf: maskCpfCnpj(e.target.value) })} placeholder="000.000.000-00" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">E-mail (opcional)</label>
            <input type="email" value={form.customerEmail} onChange={(e) => set({ customerEmail: e.target.value })} className={inputClass} />
          </div>
        </div>
      </section>

      {/* Venda */}
      <section className="rounded-2xl bg-white p-5 shadow-card">
        <h2 className="font-semibold">Venda</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Canal</label>
            <select value={form.channel} onChange={(e) => set({ channel: e.target.value })} className={inputClass}>
              <option value="presencial">Presencial</option>
              <option value="online">Online</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Vendedor<Req /></label>
            <input list="sellers" value={form.sellerName} onChange={(e) => set({ sellerName: e.target.value })} className={inputClass} />
            <datalist id="sellers">
              {sellers.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Nota fiscal</label>
            <select value={form.invoiceType} onChange={(e) => set({ invoiceType: e.target.value })} className={inputClass}>
              <option value="none">Sem nota</option>
              <option value="nfce">NFC-e</option>
              <option value="nfe">NF-e</option>
            </select>
          </div>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Origem (anúncio, opcional)</label>
            <select value={form.leadSource ?? ""} onChange={(e) => set({ leadSource: e.target.value })} className={inputClass}>
              <option value="">Não sei / nenhuma</option>
              <option value="meta">Instagram/Facebook (Meta)</option>
              <option value="google">Google</option>
            </select>
          </div>
        </div>
        <label className="mt-3 flex items-center gap-2">
          <input type="checkbox" checked={form.toReceive ?? false} onChange={(e) => set({ toReceive: e.target.checked })} className="h-4 w-4 rounded border-neutral-300" />
          <span className="text-sm text-neutral-700">A receber (ex: recebimento na entrega)</span>
        </label>
      </section>

      {/* Entrega */}
      <section className="rounded-2xl bg-white p-5 shadow-card">
        <h2 className="font-semibold">Entrega</h2>
        <div className="mt-3 flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="dtype" checked={isDelivery} onChange={() => set({ deliveryType: "delivery" })} />
            Entregar no endereço
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="dtype" checked={!isDelivery} onChange={() => set({ deliveryType: "pickup" })} />
            Retirada na loja
          </label>
        </div>

        {showAddress && (
          <>
            {!isDelivery && needsFiscalAddress && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                A NF-e exige o endereço do cliente, mesmo na retirada na loja.
              </p>
            )}
            <div className="mt-3 flex items-end gap-2">
              <div className="w-40">
                <label className="block text-sm font-medium text-neutral-700">CEP{isNfe && <Req />}</label>
                <input
                  inputMode="numeric"
                  value={form.cep}
                  onChange={(e) => {
                    set({ cep: maskCep(e.target.value) });
                    doLookupCep(e.target.value);
                  }}
                  placeholder="00000-000"
                  className={inputClass}
                />
              </div>
              <button type="button" onClick={() => doLookupCep(form.cep ?? "")} disabled={cepLoading || isPending} className="mb-0.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50">
                {cepLoading ? "Buscando..." : "Buscar"}
              </button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-6">
              <div className="sm:col-span-4">
                <label className="block text-sm font-medium text-neutral-700">Rua{isNfe && <Req />}</label>
                <input value={form.street} onChange={(e) => set({ street: e.target.value })} onBlur={doReverseCep} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-neutral-700">Número{isNfe && <Req />}</label>
                <input value={form.streetNumber} onChange={(e) => set({ streetNumber: e.target.value })} className={inputClass} />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-neutral-700">Complemento</label>
                <input value={form.complement} onChange={(e) => set({ complement: e.target.value })} className={inputClass} />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-sm font-medium text-neutral-700">Bairro{isNfe && <Req />}</label>
                <input value={form.neighborhood} onChange={(e) => set({ neighborhood: e.target.value })} className={inputClass} />
              </div>
              <div className="sm:col-span-4">
                <label className="block text-sm font-medium text-neutral-700">Cidade{isNfe && <Req />}</label>
                <input value={form.city} onChange={(e) => set({ city: e.target.value })} onBlur={doReverseCep} className={inputClass} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-neutral-700">UF{isNfe && <Req />}</label>
                <input maxLength={2} value={form.state} onChange={(e) => set({ state: e.target.value.toUpperCase() })} className={inputClass} />
              </div>
            </div>
          </>
        )}

        {isDelivery && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-neutral-700">Data de entrega<Req /></label>
              <input type="date" min={sp.date} value={form.deliveryDate} onChange={(e) => set({ deliveryDate: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700">Turno</label>
              <select value={form.deliveryShift} onChange={(e) => set({ deliveryShift: e.target.value })} className={inputClass}>
                <option value="">—</option>
                <option value="morning" disabled={morningClosed}>
                  Manhã{morningOff ? " (não entregamos)" : morningClosed ? ` (fechou às ${cutoffs.morning})` : ""}
                </option>
                <option value="afternoon" disabled={afternoonClosed}>
                  Tarde{afternoonOff ? " (não entregamos)" : afternoonClosed ? ` (fechou às ${cutoffs.afternoon})` : ""}
                </option>
              </select>
              {morningClosed && afternoonClosed && (
                <p className="mt-1 text-xs text-amber-700">
                  {morningOff && afternoonOff ? "Não entregamos nesse dia — escolha outra data." : "Esse dia já fechou pra entrega — escolha outra data."}
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Itens */}
      <section className="rounded-2xl bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Itens</h2>
          <button type="button" onClick={addItem} className="text-sm font-medium text-neutral-700 hover:text-neutral-900">
            + Item
          </button>
        </div>
        {products.length === 0 && (
          <p className="mt-2 text-sm text-amber-700">Cadastre produtos antes de criar o pedido.</p>
        )}
        <div className="mt-3 space-y-2">
          {form.items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2">
              <select required value={it.productId} onChange={(e) => setItem(i, { productId: e.target.value })} className="col-span-5 min-w-0 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand">
                <option value="">Produto...</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatBrl(p.priceBrl)}
                  </option>
                ))}
              </select>
              <input type="number" min="1" step="1" value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} title="Qtd" className="col-span-2 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm shadow-card" />
              <input type="number" min="0" step="0.01" value={it.discountBrl ?? ""} onChange={(e) => setItem(i, { discountBrl: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="Desc." title="Desconto" className="col-span-2 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm shadow-card" />
              <span className="col-span-2 text-right text-sm font-medium">{formatBrl(lineTotal(it))}</span>
              {form.items.length > 1 && (
                <button type="button" onClick={() => removeItem(i)} className="col-span-1 flex justify-center text-neutral-400 hover:text-red-600" aria-label="Remover"><X className="h-4 w-4" strokeWidth={2} /></button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Pagamento + totais */}
      <section className="rounded-2xl bg-white p-5 shadow-card">
        <h2 className="font-semibold">Pagamento</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Forma<Req /></label>
            <select required value={form.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value })} className={inputClass}>
              <option value="">—</option>
              {PAYMENTS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          {paymentHasInstallments(form.paymentMethod) && (
            <div>
              <label className="block text-sm font-medium text-neutral-700">Parcelas</label>
              <select value={form.installments ?? 1} onChange={(e) => set({ installments: Number(e.target.value) })} className={inputClass}>
                {Array.from({ length: 12 }, (_, k) => k + 1).map((nn) => (
                  <option key={nn} value={nn}>{nn}x</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Desconto no total (R$)</label>
            <input type="number" min="0" step="0.01" value={form.discountBrl ?? ""} onChange={(e) => set({ discountBrl: e.target.value === "" ? undefined : Number(e.target.value) })} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Frete (R$)</label>
            <input type="number" min="0" step="0.01" value={form.freightBrl ?? ""} onChange={(e) => set({ freightBrl: e.target.value === "" ? undefined : Number(e.target.value) })} className={inputClass} />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
          <span className="text-sm uppercase tracking-wide text-neutral-500">Total</span>
          <span className="text-2xl font-bold">{formatBrl(total)}</span>
        </div>
      </section>

      {/* Obs */}
      <section className="rounded-2xl bg-white p-5 shadow-card">
        <label className="block text-sm font-medium text-neutral-700">Observações</label>
        <textarea rows={2} value={form.notes} onChange={(e) => set({ notes: e.target.value })} className={inputClass} />
      </section>

      {/* Nota fiscal (só em pedido já salvo) — agora como seção do pedido, não solta no rodapé */}
      {fiscalSlot}

      <div className="flex justify-end gap-2 border-t border-neutral-200 pt-5">
        <button type="button" onClick={discard} className="rounded-lg border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
          Voltar sem salvar
        </button>
        <button type="submit" disabled={isPending} className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-400">
          {isPending ? "Salvando..." : orderId ? "Atualizar pedido" : "Salvar pedido"}
        </button>
      </div>
    </form>
  );
}
