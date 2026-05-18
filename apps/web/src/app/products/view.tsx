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

export interface ProductRow {
  id: string;
  name: string;
  description: string | null;
  priceBrl: number;
  imageUrl: string | null;
  stock: number;
  active: boolean;
}

function blank(): ProductInput {
  return { name: "", description: "", priceBrl: 0, imageUrl: "", stock: 0, active: true };
}

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function ProductsView({ initial, storeName }: { initial: ProductRow[]; storeName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<ProductRow | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

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
                <th className="px-6 py-3 text-right">Estoque</th>
                <th className="px-6 py-3 text-center">Ativo</th>
                <th className="px-6 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {initial.map((p) => (
                <tr key={p.id} className="border-b border-neutral-100 last:border-0">
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
                        <div className="font-medium">{p.name}</div>
                        {p.description && (
                          <div className="line-clamp-1 text-xs text-neutral-500">
                            {p.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium">{formatBrl(p.priceBrl)}</td>
                  <td className="px-6 py-4 text-right">
                    <span
                      className={
                        p.stock === 0
                          ? "text-red-600"
                          : p.stock < 5
                            ? "text-amber-600"
                            : "text-neutral-700"
                      }
                    >
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      type="button"
                      onClick={() => handleToggle(p.id, !p.active)}
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
                      onClick={() => {
                        setError(null);
                        setEditing(p);
                      }}
                      className="mr-2 text-sm text-neutral-600 hover:text-neutral-900"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(p.id, p.name)}
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

      {editing && (
        <ProductDialog
          initial={editing === "new" ? blank() : toInput(editing)}
          editingId={editing === "new" ? null : editing.id}
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
    description: p.description ?? "",
    priceBrl: p.priceBrl,
    imageUrl: p.imageUrl ?? "",
    stock: p.stock,
    active: p.active,
  };
}

function ProductDialog({
  initial,
  editingId,
  onClose,
  onSaved,
}: {
  initial: ProductInput;
  editingId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ProductInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
        className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-xl font-semibold">
          {editingId ? "Editar produto" : "Novo produto"}
        </h2>

        <div>
          <label className="block text-sm font-medium text-neutral-700">Nome</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Preço (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={form.priceBrl}
              onChange={(e) => setForm({ ...form, priceBrl: Number(e.target.value) })}
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
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700">URL da imagem (opcional)</label>
          <input
            type="url"
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            placeholder="https://..."
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
          <p className="mt-1 text-xs text-neutral-500">
            Por enquanto cole a URL de uma imagem. Upload direto vem na próxima atualização.
          </p>
        </div>

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
