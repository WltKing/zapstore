"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createProductAction,
  updateProductAction,
  deleteProductAction,
  toggleProductAction,
  type ProductInput,
} from "@/lib/actions/products";
import { ImageUpload } from "@/components/image-upload";
import { NfeImportDialog } from "@/components/nfe-import-dialog";
import { priceFromCostMargin } from "@/lib/pricing";

export interface ProductRow {
  id: string;
  name: string;
  fiscalName: string | null;
  description: string | null;
  category: string | null;
  kind: string;
  priceBrl: number;
  costBrl: number | null;
  imageUrl: string | null;
  realImageUrl: string | null;
  stock: number;
  lowStockThreshold: number;
  ncm: string | null;
  cest: string | null;
  cfopEntrada: string | null;
  origem: string | null;
  active: boolean;
  kitItems: { componentId: string; componentName: string; qty: number }[];
}

function blank(): ProductInput {
  return {
    name: "",
    fiscalName: "",
    description: "",
    category: "",
    kind: "simple",
    priceBrl: 0,
    costBrl: null,
    imageUrl: "",
    realImageUrl: "",
    stock: 0,
    lowStockThreshold: 5,
    ncm: "",
    cest: "",
    cfopEntrada: "",
    origem: "",
    active: true,
    kitItems: [],
  };
}

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

/** Margem de lucro a partir de preço e custo. "—" se não houver custo. */
function marginLabel(price: number, cost: number | null): string {
  if (cost == null || price <= 0) return "—";
  return `${(((price - cost) / price) * 100).toFixed(0)}%`;
}

export function ProductsView({
  initial,
  storeName,
  defaultMarginPct,
  roundTo90,
}: {
  initial: ProductRow[];
  storeName: string;
  defaultMarginPct: number | null;
  roundTo90: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<ProductRow | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lowStockItems = initial.filter((p) => p.active && p.stock <= p.lowStockThreshold);

  const handleToggle = (id: string, active: boolean) => {
    startTransition(async () => {
      const res = await toggleProductAction(id, active);
      if (!res.ok) setError(res.error ?? "Erro");
      else router.refresh();
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Excluir "${name}"? Essa acao nao pode ser desfeita.`)) return;
    startTransition(async () => {
      const res = await deleteProductAction(id);
      if (!res.ok) setError(res.error ?? "Erro");
      else router.refresh();
    });
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Produtos</h1>
        </div>
        <div className="flex gap-2">
          <a
            href="/dashboard"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Voltar
          </a>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setImporting(true);
            }}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Importar XML
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setEditing("new");
            }}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            + Novo produto
          </button>
        </div>
      </header>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {lowStockItems.length > 0 && (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ {lowStockItems.length}{" "}
          {lowStockItems.length === 1
            ? "produto com estoque baixo"
            : "produtos com estoque baixo"}{" "}
          (destacados em vermelho).
        </p>
      )}

      <section className="mt-8 rounded-2xl bg-white shadow-sm">
        {initial.length === 0 ? (
          <div className="p-12 text-center">
            <h2 className="text-lg font-semibold">Nenhum produto cadastrado</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Cadastre o primeiro produto pro bot começar a oferecer.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-6 py-3 text-left">Produto</th>
                <th className="px-6 py-3 text-right">Preço</th>
                <th className="px-6 py-3 text-right">Margem</th>
                <th className="px-6 py-3 text-right">Estoque</th>
                <th className="px-6 py-3 text-center">Ativo</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {initial.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => {
                    setError(null);
                    setEditing(p);
                  }}
                  className="cursor-pointer border-b border-neutral-100 last:border-0 hover:bg-neutral-50"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-xs text-neutral-400">
                          —
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{p.name}</span>
                          {p.kind === "kit" && (
                            <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-600">
                              Kit
                            </span>
                          )}
                          {p.category && (
                            <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                              {p.category}
                            </span>
                          )}
                        </div>
                        {p.description && (
                          <div className="line-clamp-1 text-xs text-neutral-500">
                            {p.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium">{formatBrl(p.priceBrl)}</td>
                  <td className="px-6 py-4 text-right text-neutral-600">
                    {marginLabel(p.priceBrl, p.costBrl)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={
                        p.stock <= p.lowStockThreshold
                          ? "font-medium text-red-600"
                          : "text-neutral-700"
                      }
                    >
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(p.id, !p.active);
                      }}
                      disabled={isPending}
                      className={`inline-flex h-6 w-11 items-center rounded-full transition ${
                        p.active ? "bg-emerald-500" : "bg-neutral-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                          p.active ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setError(null);
                        setEditing(p);
                      }}
                      className="mr-2 text-sm text-neutral-600 hover:text-neutral-900"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(p.id, p.name);
                      }}
                      disabled={isPending}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {importing && (
        <NfeImportDialog
          products={initial.map((p) => ({ id: p.id, name: p.name, fiscalName: p.fiscalName }))}
          defaultMarginPct={defaultMarginPct}
          roundTo90={roundTo90}
          onClose={() => setImporting(false)}
        />
      )}

      {editing && (
        <ProductDialog
          initial={editing === "new" ? blank() : toInput(editing)}
          editingId={editing === "new" ? null : editing.id}
          allProducts={initial}
          defaultMarginPct={defaultMarginPct}
          roundTo90={roundTo90}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </main>
  );
}

function toInput(p: ProductRow): ProductInput {
  return {
    name: p.name,
    fiscalName: p.fiscalName ?? "",
    description: p.description ?? "",
    category: p.category ?? "",
    kind: p.kind,
    priceBrl: p.priceBrl,
    costBrl: p.costBrl,
    imageUrl: p.imageUrl ?? "",
    realImageUrl: p.realImageUrl ?? "",
    stock: p.stock,
    lowStockThreshold: p.lowStockThreshold,
    ncm: p.ncm ?? "",
    cest: p.cest ?? "",
    cfopEntrada: p.cfopEntrada ?? "",
    origem: p.origem ?? "",
    active: p.active,
    kitItems: p.kitItems.map((k) => ({ componentId: k.componentId, qty: k.qty })),
  };
}

function ProductDialog({
  initial,
  editingId,
  allProducts,
  defaultMarginPct,
  roundTo90,
  onClose,
  onSaved,
}: {
  initial: ProductInput;
  editingId: string | null;
  allProducts: ProductRow[];
  defaultMarginPct: number | null;
  roundTo90: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ProductInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Preço sugerido pela margem padrão da loja (margem sobre a venda).
  const suggestedPrice = priceFromCostMargin(form.costBrl, defaultMarginPct, roundTo90);

  // Produtos que podem entrar num kit: simples e diferentes do próprio.
  const componentOptions = allProducts.filter((p) => p.kind === "simple" && p.id !== editingId);
  const kitItems = form.kitItems ?? [];
  const setKitItem = (i: number, patch: Partial<{ componentId: string; qty: number }>) =>
    setForm((f) => ({
      ...f,
      kitItems: (f.kitItems ?? []).map((it, idx) => (idx === i ? { ...it, ...patch } : it)),
    }));
  const addKitItem = () =>
    setForm((f) => ({ ...f, kitItems: [...(f.kitItems ?? []), { componentId: "", qty: 1 }] }));
  const removeKitItem = (i: number) =>
    setForm((f) => ({ ...f, kitItems: (f.kitItems ?? []).filter((_, idx) => idx !== i) }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = editingId
        ? await updateProductAction(editingId, form)
        : await createProductAction(form);
      if (!res.ok) setError(res.error ?? "Erro");
      else onSaved();
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-xl font-semibold">
          {editingId ? "Editar produto" : "Novo produto"}
        </h2>

        <div>
          <label className="block text-sm font-medium text-neutral-700">Nome (comercial)</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nome que o cliente e o bot veem"
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700">Nome na nota (fiscal, opcional)</label>
          <input
            value={form.fiscalName}
            onChange={(e) => setForm({ ...form, fiscalName: e.target.value })}
            placeholder="Como o produto sai na nota fiscal"
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700">Descrição</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700">Categoria (opcional)</label>
          <input
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="Ex: Casal, Queen, Solteiro..."
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700">Tipo</label>
          <select
            value={form.kind}
            onChange={(e) => setForm({ ...form, kind: e.target.value })}
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          >
            <option value="simple">Produto simples</option>
            <option value="kit">Kit (conjunto)</option>
          </select>
          {form.kind === "kit" && (
            <div className="mt-3 rounded-lg border border-neutral-200 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-700">Composição do kit</span>
                <button
                  type="button"
                  onClick={addKitItem}
                  className="text-sm font-medium text-neutral-700 hover:text-neutral-900"
                >
                  + Produto
                </button>
              </div>
              {componentOptions.length === 0 ? (
                <p className="mt-2 text-xs text-neutral-500">
                  Cadastre produtos simples primeiro pra montar o kit.
                </p>
              ) : kitItems.length === 0 ? (
                <p className="mt-2 text-xs text-neutral-500">
                  Adicione os produtos que compõem este kit — serão desmembrados no pedido.
                </p>
              ) : (
                <div className="mt-2 space-y-2">
                  {kitItems.map((it, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <select
                        value={it.componentId}
                        onChange={(e) => setKitItem(i, { componentId: e.target.value })}
                        className="min-w-0 flex-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      >
                        <option value="">Selecione...</option>
                        {componentOptions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={it.qty}
                        onChange={(e) => setKitItem(i, { qty: Number(e.target.value) })}
                        className="w-16 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                      />
                      <button
                        type="button"
                        onClick={() => removeKitItem(i)}
                        className="text-neutral-400 hover:text-red-600"
                        aria-label="Remover"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Preço de venda (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={form.priceBrl}
              onChange={(e) => setForm({ ...form, priceBrl: Number(e.target.value) })}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
            {suggestedPrice != null && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, priceBrl: suggestedPrice }))}
                className="mt-1 text-xs font-medium text-neutral-600 underline hover:text-neutral-900"
              >
                Aplicar margem base ({defaultMarginPct}%): {formatBrl(suggestedPrice)}
              </button>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Custo (R$, opcional)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.costBrl ?? ""}
              onChange={(e) => {
                const cost = e.target.value === "" ? null : Number(e.target.value);
                // Mexeu no custo → recalcula o preço pela margem base (sempre, se houver margem).
                const p = priceFromCostMargin(cost, defaultMarginPct, roundTo90);
                setForm((f) => ({ ...f, costBrl: cost, ...(p != null ? { priceBrl: p } : {}) }));
              }}
              placeholder="pra calcular margem"
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Estoque</label>
            <input
              type="number"
              min="0"
              step="1"
              required
              value={form.stock}
              onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Alerta de estoque baixo</label>
            <input
              type="number"
              min="0"
              step="1"
              required
              value={form.lowStockThreshold}
              onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })}
              className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>
        </div>

        <ImageUpload
          label="Imagem de catálogo (opcional)"
          value={form.imageUrl ?? ""}
          onChange={(url) => setForm({ ...form, imageUrl: url })}
        />

        <ImageUpload
          label={'Imagem "real" (opcional)'}
          value={form.realImageUrl ?? ""}
          onChange={(url) => setForm({ ...form, realImageUrl: url })}
        />

        <details className="rounded-lg border border-neutral-200 p-3">
          <summary className="cursor-pointer text-sm font-medium text-neutral-700">
            Dados fiscais (opcional)
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-neutral-600">NCM</label>
              <input
                value={form.ncm}
                onChange={(e) => setForm({ ...form, ncm: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600">CEST</label>
              <input
                value={form.cest}
                onChange={(e) => setForm({ ...form, cest: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600">CFOP entrada</label>
              <input
                value={form.cfopEntrada}
                onChange={(e) => setForm({ ...form, cfopEntrada: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600">Origem (0-8)</label>
              <input
                value={form.origem}
                onChange={(e) => setForm({ ...form, origem: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            Usados quando ativarmos a emissão de nota fiscal (módulo futuro).
          </p>
        </details>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="h-4 w-4 rounded border-neutral-300"
          />
          <span className="text-sm text-neutral-700">Produto ativo (visível para o bot)</span>
        </label>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-400"
          >
            {isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
