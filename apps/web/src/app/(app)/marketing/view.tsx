"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Plus, X, Megaphone, Search, TrendingUp } from "lucide-react";
import { useAccess } from "@/lib/access-context";
import {
  createSpendAction,
  deleteSpendAction,
  updateSpendAction,
  saveMarketingKeywordsAction,
  type SpendInput,
} from "@/lib/actions/marketing";
import { DuoBars } from "../dashboard/charts";

export interface SpendRow {
  id: string;
  channel: string;
  amountBrl: number;
  notes: string | null;
}
export interface EvoPoint {
  label: string;
  online: number;
  invest: number;
}
export interface ChannelStats {
  canal: "meta" | "google";
  invest: number;
  revenue: number;
  count: number;
  leads: number;
  ticket: number;
  conversionPct: number | null;
  roas: number | null;
  cac: number | null;
  avgRoas: number | null; // ROAS médio histórico (pro simulador)
  roasMonths: number; // quantos meses entraram na média
}

const CHANNEL_LABEL: Record<string, string> = {
  meta: "Meta (Face/Insta)",
  google: "Google",
  outros: "Outros",
};
function channelLabel(c: string): string {
  return CHANNEL_LABEL[c] ?? c.charAt(0).toUpperCase() + c.slice(1);
}
function formatBrl(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function MarketingView({
  storeName,
  monthKey,
  investTotal,
  onlineRevenue,
  onlineCount,
  totalRevenue,
  roas,
  cac,
  ticket,
  pctFaturamento,
  meta,
  google,
  semOrigemRevenue,
  evolution,
  forecastNextMonth,
  spends,
  keywords,
}: {
  storeName: string;
  monthKey: string;
  investTotal: number;
  onlineRevenue: number;
  onlineCount: number;
  totalRevenue: number;
  roas: number | null;
  cac: number | null;
  ticket: number;
  pctFaturamento: number;
  meta: ChannelStats;
  google: ChannelStats;
  semOrigemRevenue: number;
  evolution: EvoPoint[];
  forecastNextMonth: number;
  spends: SpendRow[];
  keywords: { meta: string[]; google: string[] };
}) {
  const router = useRouter();
  const { canDelete } = useAccess();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<SpendRow | "new" | null>(null);

  const monthOptions: string[] = [];
  {
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthOptions.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    if (!monthOptions.includes(monthKey)) monthOptions.unshift(monthKey);
  }

  const remove = (id: string) => {
    if (!confirm("Excluir este investimento?")) return;
    startTransition(async () => {
      const r = await deleteSpendAction(id);
      if (!r.ok) setError(r.error ?? "Erro");
      else router.refresh();
    });
  };

  const noKeywords = keywords.meta.length === 0 && keywords.google.length === 0;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Marketing</h1>
        </div>
        <select
          value={monthKey}
          onChange={(e) => router.push(`/marketing?month=${e.target.value}`)}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm capitalize shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          {monthOptions.map((m) => (
            <option key={m} value={m} className="capitalize">
              {monthLabel(m)}
            </option>
          ))}
        </select>
      </header>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {/* KPIs gerais do mês */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Kpi title="Investimento" value={formatBrl(investTotal)} hint="Em anúncios no mês" />
        <Kpi title="Vendas online" value={formatBrl(onlineRevenue)} hint={`${onlineCount} pedido(s) online`} />
        <Kpi
          title="ROAS geral"
          value={roas == null ? "—" : `${roas.toFixed(2)}x`}
          hint="Vendas online ÷ investimento"
          tone={roas != null && roas >= 1 ? "green" : roas != null ? "red" : "neutral"}
        />
        <Kpi title="CAC geral" value={cac == null ? "—" : formatBrl(cac)} hint="Custo por venda online" />
        <Kpi title="Ticket online" value={formatBrl(ticket)} hint="Médio por pedido online" />
        <Kpi
          title="% do faturamento"
          value={`${pctFaturamento.toFixed(0)}%`}
          hint={`Online sobre ${formatBrl(totalRevenue)}`}
        />
      </div>

      {/* Por canal */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        Resultado por canal — {monthLabel(monthKey)}
      </h2>
      {noKeywords && (
        <p className="mt-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Pra separar Meta × Google, configure as <strong>frases de identificação</strong> no fim da
          página — o bot reconhece a frase do anúncio e marca cada venda com a origem certa.
        </p>
      )}
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <ChannelCard stats={meta} />
        <ChannelCard stats={google} />
      </div>
      {semOrigemRevenue > 0 && (
        <p className="mt-2 text-xs text-neutral-400">
          {formatBrl(semOrigemRevenue)} em vendas online sem origem identificada neste mês (cliente
          não veio por frase de anúncio).
        </p>
      )}

      {/* Projeções */}
      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">Projeções</h2>
      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-[18px] w-[18px] text-neutral-400" strokeWidth={2} />
            <h3 className="font-semibold">Próximo mês (estimado)</h3>
          </div>
          <div className="mt-2 text-2xl font-bold">{formatBrl(forecastNextMonth)}</div>
          <p className="mt-1 text-xs text-neutral-400">
            Estimativa de vendas online — média dos últimos 3 meses. Mantendo o ritmo (e o
            investimento), é o esperado pro mês que vem.
          </p>
        </div>
        <Simulator meta={meta} google={google} />
      </div>

      {/* Evolução */}
      <section className="mt-8 rounded-2xl bg-white p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Vendas online × Investimento (6 meses)
          </h2>
          <div className="flex gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Vendas online
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-indigo-500" /> Investimento
            </span>
          </div>
        </div>
        <DuoBars
          data={evolution.map((e) => ({ label: e.label, a: e.online, b: e.invest }))}
          aLabel="Vendas online"
          bLabel="Investimento"
          aColor="#10b981"
          bColor="#6366f1"
          empty="Sem dados ainda."
        />
      </section>

      {/* Lançamentos de investimento */}
      <section className="mt-8 rounded-2xl bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-4 sm:px-6">
          <h2 className="font-semibold">Investimentos do mês</h2>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setEditing("new");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Lançar investimento
          </button>
        </div>
        {spends.length === 0 ? (
          <p className="px-4 pb-6 text-sm text-neutral-500 sm:px-6">
            Lance quanto investiu em cada canal pra ver ROAS, CAC e as projeções.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {spends.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
                <div className="min-w-0">
                  <span className="font-medium capitalize">{channelLabel(s.channel)}</span>
                  {s.notes && <span className="ml-2 text-xs text-neutral-500">{s.notes}</span>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-medium">{formatBrl(s.amountBrl)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setEditing(s);
                    }}
                    title="Editar"
                    className="inline-flex items-center justify-center text-neutral-400 hover:text-neutral-700"
                  >
                    <Pencil className="h-[18px] w-[18px]" strokeWidth={2} />
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => remove(s.id)}
                      disabled={isPending}
                      title="Excluir"
                      className="inline-flex items-center justify-center text-neutral-400 hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-[18px] w-[18px]" strokeWidth={2} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Frases de identificação de origem */}
      <KeywordsEditor initial={keywords} />

      {editing && (
        <SpendDialog
          monthKey={monthKey}
          spend={editing === "new" ? null : editing}
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

function Kpi({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint: string;
  tone?: "green" | "red" | "neutral";
}) {
  const c = tone === "green" ? "text-emerald-700" : tone === "red" ? "text-red-700" : "text-neutral-900";
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="text-xs uppercase tracking-wide text-neutral-500">{title}</div>
      <div className={`mt-1 text-2xl font-bold ${c}`}>{value}</div>
      <div className="mt-1 text-xs text-neutral-400">{hint}</div>
    </div>
  );
}

/** Card de resultado de um canal (Meta ou Google). */
function ChannelCard({ stats }: { stats: ChannelStats }) {
  const isMeta = stats.canal === "meta";
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex items-center gap-2">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            isMeta ? "bg-blue-50 text-blue-600" : "bg-emerald-50 text-emerald-600"
          }`}
        >
          {isMeta ? (
            <Megaphone className="h-[18px] w-[18px]" strokeWidth={2} />
          ) : (
            <Search className="h-[18px] w-[18px]" strokeWidth={2} />
          )}
        </span>
        <h3 className="font-semibold">{isMeta ? "Meta (Instagram/Facebook)" : "Google"}</h3>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Stat label="Investimento" value={formatBrl(stats.invest)} />
        <Stat label="Vendas" value={`${formatBrl(stats.revenue)} (${stats.count})`} />
        <Stat label="Leads (conversas)" value={String(stats.leads)} />
        <Stat
          label="Conversão"
          value={stats.conversionPct == null ? "—" : `${stats.conversionPct.toFixed(0)}%`}
        />
        <Stat
          label="ROAS"
          value={stats.roas == null ? "—" : `${stats.roas.toFixed(2)}x`}
          tone={stats.roas == null ? undefined : stats.roas >= 1 ? "green" : "red"}
        />
        <Stat label="CAC" value={stats.cac == null ? "—" : formatBrl(stats.cac)} />
        <Stat label="Ticket médio" value={stats.count > 0 ? formatBrl(stats.ticket) : "—"} />
        <Stat
          label="ROAS médio (3m)"
          value={stats.avgRoas == null ? "—" : `${stats.avgRoas.toFixed(2)}x`}
        />
      </div>

      {stats.invest > 0 && stats.count === 0 && stats.leads === 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Tem investimento mas nenhum lead identificado — confira as frases de identificação no fim
          da página.
        </p>
      )}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "green" | "red" }) {
  const c = tone === "green" ? "text-emerald-700" : tone === "red" ? "text-red-700" : "text-neutral-900";
  return (
    <div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`font-semibold ${c}`}>{value}</div>
    </div>
  );
}

/** Simulador: "se eu investir R$X no canal, a estimativa é vender R$Y". */
function Simulator({ meta, google }: { meta: ChannelStats; google: ChannelStats }) {
  const [canal, setCanal] = useState<"meta" | "google">("meta");
  const [amount, setAmount] = useState("");
  const stats = canal === "meta" ? meta : google;
  const value = Number(amount.replace(",", "."));
  const valid = Number.isFinite(value) && value > 0;
  const estimate = valid && stats.avgRoas != null ? value * stats.avgRoas : null;
  const estimatedSales = estimate != null && stats.ticket > 0 ? Math.round(estimate / stats.ticket) : null;

  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <h3 className="font-semibold">Simulador de investimento</h3>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-neutral-500">Canal</label>
          <select
            value={canal}
            onChange={(e) => setCanal(e.target.value as "meta" | "google")}
            className="mt-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card"
          >
            <option value="meta">Meta (Face/Insta)</option>
            <option value="google">Google</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500">Se eu investir (R$)</label>
          <input
            type="number"
            min="0"
            step="50"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="ex: 1000"
            className="mt-1 w-32 rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card"
          />
        </div>
      </div>
      {stats.avgRoas == null ? (
        <p className="mt-3 text-xs text-neutral-400">
          Sem histórico suficiente nesse canal — lance o investimento do mês e deixe as vendas
          acontecerem pra liberar a estimativa.
        </p>
      ) : estimate != null ? (
        <p className="mt-3 text-sm text-neutral-700">
          Estimativa de vendas: <strong className="text-emerald-700">{formatBrl(estimate)}</strong>
          {estimatedSales != null && estimatedSales > 0 && (
            <span className="text-neutral-500"> (~{estimatedSales} venda{estimatedSales > 1 ? "s" : ""})</span>
          )}
          <span className="mt-1 block text-xs text-neutral-400">
            Base: ROAS médio de {stats.avgRoas.toFixed(2)}x dos últimos {stats.roasMonths} mês(es) — é
            estimativa, não garantia.
          </span>
        </p>
      ) : (
        <p className="mt-3 text-xs text-neutral-400">
          Digite um valor pra ver a estimativa (base: ROAS médio de {stats.avgRoas.toFixed(2)}x).
        </p>
      )}
    </div>
  );
}

/** Editor das frases que identificam a origem (o bot casa a frase na 1ª mensagem). */
function KeywordsEditor({ initial }: { initial: { meta: string[]; google: string[] } }) {
  const router = useRouter();
  const [metaList, setMetaList] = useState<string[]>(initial.meta);
  const [googleList, setGoogleList] = useState<string[]>(initial.google);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const r = await saveMarketingKeywordsAction({ meta: metaList, google: googleList });
      if (!r.ok) setError(r.error ?? "Erro");
      else {
        setSaved(true);
        router.refresh();
      }
    });
  };

  return (
    <section className="mt-8 rounded-2xl bg-white p-5 shadow-card sm:p-6">
      <h2 className="font-semibold">Identificação de origem (frases dos anúncios)</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Anúncio com botão de WhatsApp manda uma mensagem pronta (ex:{" "}
        <em>&quot;Vi o anúncio no Instagram e quero saber mais&quot;</em>). Cadastre essa frase no canal
        certo: quando o cliente iniciar a conversa com ela, o sistema marca os pedidos dele como
        vindos daquele canal — é assim que o ROAS e o CAC de cada canal são calculados.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <KeywordList title="Frases do Meta (Instagram/Facebook)" list={metaList} onChange={setMetaList} />
        <KeywordList title="Frases do Google" list={googleList} onChange={setGoogleList} />
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Frases salvas!</p>}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-400"
        >
          {isPending ? "Salvando..." : "Salvar frases"}
        </button>
      </div>
    </section>
  );
}

function KeywordList({
  title,
  list,
  onChange,
}: {
  title: string;
  list: string[];
  onChange: (l: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v.length < 3 || list.includes(v)) return;
    onChange([...list, v]);
    setDraft("");
  };
  return (
    <div className="min-w-0 rounded-xl border border-neutral-200 p-3 sm:p-4">
      <h3 className="break-words text-sm font-medium text-neutral-700">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {list.length === 0 && <span className="text-xs text-neutral-400">Nenhuma frase ainda.</span>}
        {list.map((p) => (
          <span
            key={p}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-700"
          >
            <span className="min-w-0 break-words">{p}</span>
            <button
              type="button"
              onClick={() => onChange(list.filter((x) => x !== p))}
              className="shrink-0 text-neutral-400 hover:text-red-600"
              aria-label="Remover"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Digite a frase..."
          className="w-0 min-w-0 flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
        <button
          type="button"
          onClick={add}
          title="Adicionar"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          <span className="hidden sm:inline">Adicionar</span>
        </button>
      </div>
    </div>
  );
}

function SpendDialog({
  monthKey,
  spend,
  onClose,
  onSaved,
}: {
  monthKey: string;
  spend: SpendRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<SpendInput>(
    spend
      ? { month: monthKey, channel: spend.channel, amountBrl: spend.amountBrl, notes: spend.notes ?? "" }
      : { month: monthKey, channel: "meta", amountBrl: 0, notes: "" },
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = spend ? await updateSpendAction(spend.id, form) : await createSpendAction(form);
      if (!r.ok) setError(r.error ?? "Erro");
      else onSaved();
    });
  };

  const inputClass =
    "mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-xl font-semibold">{spend ? "Editar investimento" : "Lançar investimento"}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Canal</label>
            <select
              required
              value={form.channel}
              onChange={(e) => setForm({ ...form, channel: e.target.value })}
              className={inputClass}
            >
              <option value="meta">Meta (Face/Insta)</option>
              <option value="google">Google</option>
              <option value="outros">Outros</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Valor (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.amountBrl}
              onChange={(e) => setForm({ ...form, amountBrl: Number(e.target.value) })}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-neutral-700">Observação (opcional)</label>
          <input
            value={form.notes ?? ""}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Ex: campanha de colchões"
            className={inputClass}
          />
        </div>
        <p className="text-xs text-neutral-400">Competência: {monthKey}</p>
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
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-400"
          >
            {isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </div>
  );
}
