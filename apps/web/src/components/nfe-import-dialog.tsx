"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importNfeAction, type NfeImportLine } from "@/lib/actions/nfe";
import { priceFromCostMargin } from "@/lib/pricing";

/** Produto existente, pro casamento por nome na conferência. */
export interface ExistingProduct {
  id: string;
  name: string;
  fiscalName: string | null;
}

interface ParsedItem {
  cProd: string;
  xProd: string;
  ncm: string;
  cfop: string;
  origem: string;
  qty: number;
  unitCost: number;
}

interface ParsedNfe {
  supplierName: string;
  number: string;
  items: ParsedItem[];
}

/** Normaliza texto pra casar nomes (sem acento, maiúsculo, espaços colapsados). */
function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Lê um <det> da NFe extraindo os campos que interessam. */
function readDet(det: Element): ParsedItem | null {
  const get = (tag: string) => det.getElementsByTagName(tag)[0]?.textContent?.trim() ?? "";
  const xProd = get("xProd");
  if (!xProd) return null;
  return {
    cProd: get("cProd"),
    xProd,
    ncm: get("NCM"),
    cfop: get("CFOP"),
    origem: get("orig"), // primeiro <orig> dentro do bloco de imposto do item
    qty: Number(get("qCom")) || 0,
    unitCost: Number(get("vUnCom")) || 0,
  };
}

/** Parseia o XML de uma NFe (modelo 55) no navegador, sem dependência externa. */
function parseNfe(xml: string): ParsedNfe {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Arquivo XML inválido.");
  }
  const dets = Array.from(doc.getElementsByTagName("det"));
  const items = dets.map(readDet).filter((i): i is ParsedItem => i !== null);
  if (items.length === 0) throw new Error("Nenhum produto encontrado neste XML.");
  const emit = doc.getElementsByTagName("emit")[0];
  const supplierName =
    emit?.getElementsByTagName("xFant")[0]?.textContent?.trim() ||
    emit?.getElementsByTagName("xNome")[0]?.textContent?.trim() ||
    "Fornecedor";
  const number = doc.getElementsByTagName("ide")[0]?.getElementsByTagName("nNF")[0]?.textContent?.trim() ?? "";
  return { supplierName, number, items };
}

type LineState = NfeImportLine & { _xProd: string };

export function NfeImportDialog({
  products,
  defaultMarginPct,
  roundTo90,
  onClose,
}: {
  products: ExistingProduct[];
  defaultMarginPct: number | null;
  roundTo90: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nfe, setNfe] = useState<ParsedNfe | null>(null);
  const [lines, setLines] = useState<LineState[]>([]);
  const [margin, setMargin] = useState(defaultMarginPct != null ? String(defaultMarginPct) : "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Índice nome-normalizado -> produto, pra sugerir vínculo automático.
  const byName = useMemo(() => {
    const m = new Map<string, ExistingProduct>();
    for (const p of products) {
      m.set(norm(p.name), p);
      if (p.fiscalName) m.set(norm(p.fiscalName), p);
    }
    return m;
  }, [products]);

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseNfe(text);
      const m = margin.trim() === "" ? null : Number(margin);
      setNfe(parsed);
      setLines(
        parsed.items.map((it) => {
          const match = byName.get(norm(it.xProd));
          return {
            _xProd: it.xProd,
            action: match ? "link" : "create",
            linkProductId: match?.id ?? null,
            updateCost: true,
            name: it.xProd,
            fiscalName: it.xProd,
            ncm: it.ncm,
            cfopEntrada: it.cfop,
            origem: it.origem,
            qty: it.qty,
            unitCost: it.unitCost,
            priceBrl: priceFromCostMargin(it.unitCost, m, roundTo90) ?? 0,
          };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao ler o XML.");
      setNfe(null);
      setLines([]);
    }
  };

  // Recalcula o preço de todas as linhas pela margem (custo da nota ÷ (1 - margem)).
  const applyMargin = (value: string) => {
    setMargin(value);
    const m = value.trim() === "" ? null : Number(value);
    setLines((ls) =>
      ls.map((l) => {
        const p = priceFromCostMargin(l.unitCost, m, roundTo90);
        return p != null ? { ...l, priceBrl: p } : l;
      }),
    );
  };

  const setLine = (i: number, patch: Partial<LineState>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const handleImport = () => {
    setError(null);
    const payload: NfeImportLine[] = lines.map(({ _xProd, ...l }) => l);
    startTransition(async () => {
      const res = await importNfeAction(payload);
      if (!res.ok) {
        setError(res.error ?? "Erro");
        return;
      }
      onClose();
      router.refresh();
    });
  };

  const summary = useMemo(() => {
    const create = lines.filter((l) => l.action === "create").length;
    const link = lines.filter((l) => l.action === "link").length;
    return { create, link };
  }, [lines]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 p-6">
          <div>
            <h2 className="text-xl font-semibold">Importar XML de nota</h2>
            <p className="text-sm text-neutral-500">
              {nfe
                ? `${nfe.supplierName} · NF ${nfe.number} · ${lines.length} ${lines.length === 1 ? "item" : "itens"}`
                : "Selecione o XML da NF-e de entrada (compra) pra cadastrar/atualizar produtos."}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700" aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!nfe ? (
            <div className="rounded-xl border-2 border-dashed border-neutral-300 p-12 text-center">
              <input
                ref={fileRef}
                type="file"
                accept=".xml,text/xml,application/xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Escolher arquivo XML
              </button>
              <p className="mt-3 text-xs text-neutral-500">
                Use o XML da nota de entrada (não o PDF/DANFE).
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-neutral-50 p-3">
                <label className="text-sm font-medium text-neutral-700">Margem (%)</label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  step="0.5"
                  value={margin}
                  onChange={(e) => applyMargin(e.target.value)}
                  placeholder="ex: 30"
                  className="w-24 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                />
                <span className="text-xs text-neutral-500">
                  preenche o preço de venda pelo custo da nota (e atualiza o preço dos produtos
                  vinculados).
                </span>
              </div>

              {lines.map((l, i) => (
                <div key={i} className="rounded-xl border border-neutral-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{l._xProd}</p>
                      <p className="text-xs text-neutral-500">
                        Qtd <strong>{l.qty}</strong> · custo un. {formatBrl(l.unitCost)}
                        {l.ncm ? ` · NCM ${l.ncm}` : ""}
                      </p>
                    </div>
                    <select
                      value={l.action}
                      onChange={(e) => setLine(i, { action: e.target.value as LineState["action"] })}
                      className="shrink-0 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                    >
                      <option value="create">Criar novo</option>
                      <option value="link">Somar estoque</option>
                      <option value="skip">Ignorar</option>
                    </select>
                  </div>

                  {l.action === "link" && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                      <select
                        value={l.linkProductId ?? ""}
                        onChange={(e) => setLine(i, { linkProductId: e.target.value || null })}
                        className="w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                      >
                        <option value="">Selecione o produto...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <label className="flex items-center gap-2 text-xs text-neutral-600">
                        <input
                          type="checkbox"
                          checked={l.updateCost ?? false}
                          onChange={(e) => setLine(i, { updateCost: e.target.checked })}
                          className="h-4 w-4 rounded border-neutral-300"
                        />
                        atualizar custo{margin.trim() !== "" ? " e preço" : ""}
                      </label>
                    </div>
                  )}

                  {l.action === "create" && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs text-neutral-500">Nome comercial</label>
                        <input
                          value={l.name}
                          onChange={(e) => setLine(i, { name: e.target.value })}
                          className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-500">Preço de venda (R$)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={l.priceBrl ?? 0}
                          onChange={(e) => setLine(i, { priceBrl: Number(e.target.value) })}
                          className="mt-1 w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        {nfe && (
          <div className="flex items-center justify-between border-t border-neutral-200 p-6">
            <p className="text-sm text-neutral-500">
              {summary.create} a criar · {summary.link} a atualizar
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={isPending}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-400"
              >
                {isPending ? "Importando..." : "Importar"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatBrl(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
