"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTenantNicheAction } from "@/lib/actions/admin";
import { NICHE_TEMPLATES } from "@/lib/niches";

/** Troca de nicho de uma loja — só aparece no painel do dono (super-admin).
 * Pro lojista o nicho é travado; aqui é pra manutenção/teste de layout. */
export function NicheSwitcher({ tenantId, niche }: { tenantId: string; niche: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(niche ?? "generico");
  const [isPending, startTransition] = useTransition();
  const [err, setErr] = useState(false);

  const change = (next: string) => {
    setValue(next);
    setErr(false);
    startTransition(async () => {
      const res = await setTenantNicheAction(tenantId, next);
      if (!res.ok) {
        setErr(true);
        setValue(niche ?? "generico");
      } else {
        router.refresh();
      }
    });
  };

  return (
    <select
      value={value}
      onChange={(e) => change(e.target.value)}
      disabled={isPending}
      className={`rounded-lg border px-2 py-1 text-xs ${
        err ? "border-red-400 text-red-700" : "border-neutral-300 text-neutral-700"
      } disabled:opacity-50`}
      title="Trocar nicho (só super-admin)"
    >
      {Object.values(NICHE_TEMPLATES).map((t) => (
        <option key={t.id} value={t.id}>
          {t.label}
        </option>
      ))}
    </select>
  );
}
