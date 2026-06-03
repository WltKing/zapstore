"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export interface CepResult {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
}

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Não autenticado.");
}

/** CEP -> endereço (ViaCEP). */
export async function lookupCepAction(
  cepRaw: string,
): Promise<{ ok: boolean; data?: CepResult; error?: string }> {
  try {
    await requireSession();
    const cep = cepRaw.replace(/\D/g, "");
    if (cep.length !== 8) return { ok: false, error: "CEP deve ter 8 dígitos." };
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { cache: "no-store" });
    const d = await res.json();
    if (d.erro) return { ok: false, error: "CEP não encontrado." };
    return {
      ok: true,
      data: {
        cep,
        street: d.logradouro ?? "",
        neighborhood: d.bairro ?? "",
        city: d.localidade ?? "",
        state: d.uf ?? "",
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao buscar CEP." };
  }
}

/** Endereço (UF + cidade + rua) -> lista de CEPs possíveis (ViaCEP). */
export async function searchCepAction(
  uf: string,
  city: string,
  street: string,
): Promise<{ ok: boolean; data?: CepResult[]; error?: string }> {
  try {
    await requireSession();
    if (uf.trim().length !== 2 || city.trim().length < 3 || street.trim().length < 3) {
      return { ok: false, error: "Informe estado (UF), cidade e parte da rua." };
    }
    const url = `https://viacep.com.br/ws/${encodeURIComponent(uf.trim())}/${encodeURIComponent(
      city.trim(),
    )}/${encodeURIComponent(street.trim())}/json/`;
    const res = await fetch(url, { cache: "no-store" });
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) {
      return { ok: false, error: "Nenhum CEP encontrado pra esse endereço." };
    }
    return {
      ok: true,
      data: arr.slice(0, 10).map((d) => ({
        cep: (d.cep ?? "").replace(/\D/g, ""),
        street: d.logradouro ?? "",
        neighborhood: d.bairro ?? "",
        city: d.localidade ?? "",
        state: d.uf ?? "",
      })),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha na busca de CEP." };
  }
}
