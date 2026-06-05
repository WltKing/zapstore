"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePlatformSettingAction } from "@/lib/actions/admin";

export interface KeyRow {
  key: string;
  label: string;
  help: string;
  masked: string;
  source: "banco" | "ambiente" | "nao_definido";
}

const SOURCE_LABEL: Record<KeyRow["source"], string> = {
  banco: "definida no painel",
  ambiente: "vem do ambiente (servidor)",
  nao_definido: "não definida",
};

export function KeysView({ keys }: { keys: KeyRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Chaves da plataforma</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Editáveis por você (dono). O valor salvo aqui vale pra todos os serviços (bot, fiscal...). Deixe
        em branco e salve pra remover (volta a usar a variável do servidor, se houver).
      </p>

      {msg && <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</p>}

      <div className="mt-6 space-y-4">
        {keys.map((k) => (
          <KeyEditor
            key={k.key}
            row={k}
            disabled={isPending}
            onSave={(value) => {
              setMsg(null);
              startTransition(async () => {
                const r = await savePlatformSettingAction(k.key, value);
                if (!r.ok) setMsg(r.error ?? "Erro");
                else {
                  setMsg(`"${k.label}" atualizada ✅`);
                  router.refresh();
                }
              });
            }}
          />
        ))}
      </div>
    </main>
  );
}

function KeyEditor({
  row,
  disabled,
  onSave,
}: {
  row: KeyRow;
  disabled: boolean;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">{row.label}</div>
          <div className="text-xs text-neutral-500">{row.help}</div>
        </div>
        <div className="text-right text-xs">
          <div className="font-mono text-neutral-600">{row.masked || "—"}</div>
          <div
            className={
              row.source === "banco"
                ? "text-emerald-600"
                : row.source === "ambiente"
                  ? "text-neutral-400"
                  : "text-amber-600"
            }
          >
            {SOURCE_LABEL[row.source]}
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Nova chave (deixe em branco p/ remover)"
          autoComplete="off"
          className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
        />
        <button
          type="button"
          onClick={() => onSave(value)}
          disabled={disabled}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-400"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}
