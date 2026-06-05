"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  saveFiscalConfigAction,
  uploadCertificateAction,
  linkExistingEmpresaAction,
  syncFiscalLogoAction,
  type FiscalConfigInput,
} from "@/lib/actions/fiscal";
import { lookupCepAction } from "@/lib/actions/cep";

export interface FiscalConfigData {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  inscricaoEstadual: string | null;
  regimeTributario: number;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  municipio: string | null;
  codigoMunicipio: string | null;
  uf: string | null;
  ambiente: string;
  habilitaNfce: boolean;
  habilitaNfe: boolean;
  cscNfceProd: string | null;
  idTokenNfceProd: string | null;
  certStatus: string | null;
  certCnpj: string | null;
  certValidoAte: string | null;
  hasTokens: boolean;
  enabled: boolean;
}

function blank(): FiscalConfigInput {
  return {
    cnpj: "",
    razaoSocial: "",
    nomeFantasia: "",
    inscricaoEstadual: "",
    regimeTributario: 1,
    email: "",
    telefone: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    municipio: "",
    codigoMunicipio: "",
    uf: "",
    ambiente: "homologacao",
    habilitaNfce: true,
    habilitaNfe: true,
    cscNfceProd: "",
    idTokenNfceProd: "",
  };
}

function toInput(d: FiscalConfigData): FiscalConfigInput {
  return {
    cnpj: d.cnpj,
    razaoSocial: d.razaoSocial,
    nomeFantasia: d.nomeFantasia ?? "",
    inscricaoEstadual: d.inscricaoEstadual ?? "",
    regimeTributario: d.regimeTributario,
    email: d.email ?? "",
    telefone: d.telefone ?? "",
    cep: d.cep ?? "",
    logradouro: d.logradouro ?? "",
    numero: d.numero ?? "",
    complemento: d.complemento ?? "",
    bairro: d.bairro ?? "",
    municipio: d.municipio ?? "",
    codigoMunicipio: d.codigoMunicipio ?? "",
    uf: d.uf ?? "",
    ambiente: d.ambiente,
    habilitaNfce: d.habilitaNfce,
    habilitaNfe: d.habilitaNfe,
    cscNfceProd: d.cscNfceProd ?? "",
    idTokenNfceProd: d.idTokenNfceProd ?? "",
  };
}

const input =
  "mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function FiscalView({
  storeName,
  isAdmin,
  initial,
}: {
  storeName: string;
  isAdmin: boolean;
  initial: FiscalConfigData | null;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FiscalConfigInput>(initial ? toInput(initial) : blank());
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const set = (patch: Partial<FiscalConfigInput>) => setForm((f) => ({ ...f, ...patch }));

  // Certificado
  const fileRef = useRef<HTMLInputElement>(null);
  const [certBase64, setCertBase64] = useState("");
  const [certName, setCertName] = useState("");
  const [senha, setSenha] = useState("");

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight">Fiscal</h1>
        <div className="mt-8 rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <div className="text-3xl">🔒</div>
          <p className="mt-2 text-sm text-neutral-500">Só o administrador configura a emissão fiscal.</p>
        </div>
      </main>
    );
  }

  const saveConfig = () => {
    setMsg(null);
    startTransition(async () => {
      const r = await saveFiscalConfigAction(form);
      if (!r.ok) setMsg({ kind: "err", text: r.error ?? "Erro" });
      else {
        setMsg({ kind: "ok", text: "Dados salvos." });
        router.refresh();
      }
    });
  };

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result);
      const b64 = res.includes(",") ? res.split(",")[1] : res;
      setCertBase64(b64);
      setCertName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const sendCert = () => {
    setMsg(null);
    if (!certBase64 || !senha) {
      setMsg({ kind: "err", text: "Escolha o arquivo .pfx e digite a senha." });
      return;
    }
    startTransition(async () => {
      const r = await uploadCertificateAction(certBase64, senha);
      if (!r.ok) setMsg({ kind: "err", text: r.error ?? "Erro ao enviar certificado" });
      else {
        setMsg({ kind: "ok", text: "Certificado enviado e emissão ativada! ✅" });
        setCertBase64("");
        setCertName("");
        setSenha("");
        router.refresh();
      }
    });
  };

  const syncLogo = () => {
    setMsg(null);
    startTransition(async () => {
      const r = await syncFiscalLogoAction();
      if (!r.ok) setMsg({ kind: "err", text: r.error ?? "Erro ao enviar logo" });
      else {
        setMsg({ kind: "ok", text: "Logo enviada pro Focus! Aparece nas próximas notas ✅" });
        router.refresh();
      }
    });
  };

  const linkExisting = () => {
    setMsg(null);
    startTransition(async () => {
      const r = await linkExistingEmpresaAction();
      if (!r.ok) setMsg({ kind: "err", text: r.error ?? "Erro ao vincular" });
      else {
        setMsg({ kind: "ok", text: "Empresa vinculada do Focus! Emissão ativada ✅" });
        router.refresh();
      }
    });
  };

  const lookupCep = () => {
    const cep = (form.cep ?? "").replace(/\D/g, "");
    if (cep.length !== 8) return;
    startTransition(async () => {
      const r = await lookupCepAction(cep);
      if (r.ok && r.data) {
        set({
          logradouro: r.data.street || form.logradouro,
          bairro: r.data.neighborhood || form.bairro,
          municipio: r.data.city || form.municipio,
          uf: r.data.state || form.uf,
          codigoMunicipio: r.data.ibge || form.codigoMunicipio,
        });
      }
    });
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Configuração fiscal</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Emissão de NFC-e e NF-e via Focus NFe. Comece em <strong>homologação</strong> (teste) e só
            depois mude pra produção.
          </p>
        </div>
        <a href="/dashboard" className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100">
          Voltar
        </a>
      </header>

      {msg && (
        <p
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </p>
      )}

      {/* Status */}
      <section className="mt-6 rounded-2xl bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span>
            Status:{" "}
            <strong className={initial?.enabled ? "text-emerald-700" : "text-neutral-500"}>
              {initial?.enabled ? "Ativo" : "Não configurado"}
            </strong>
          </span>
          <span>
            Certificado:{" "}
            <strong>
              {initial?.certStatus === "ok"
                ? `OK${initial.certValidoAte ? ` (válido até ${new Date(initial.certValidoAte).toLocaleDateString("pt-BR")})` : ""}`
                : initial?.certStatus === "erro"
                  ? "Erro no envio"
                  : "Pendente"}
            </strong>
          </span>
          <span>
            Ambiente: <strong className="capitalize">{initial?.ambiente ?? form.ambiente}</strong>
          </span>
        </div>
      </section>

      {/* Dados da empresa */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-card">
        <h2 className="font-semibold">Dados da empresa (emitente)</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-neutral-700">CNPJ</label>
            <input value={form.cnpj} onChange={(e) => set({ cnpj: e.target.value })} placeholder="00.000.000/0000-00" className={input} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Inscrição estadual</label>
            <input value={form.inscricaoEstadual} onChange={(e) => set({ inscricaoEstadual: e.target.value })} placeholder="ISENTO se não tiver" className={input} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Razão social</label>
            <input value={form.razaoSocial} onChange={(e) => set({ razaoSocial: e.target.value })} className={input} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Nome fantasia</label>
            <input value={form.nomeFantasia} onChange={(e) => set({ nomeFantasia: e.target.value })} className={input} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Regime tributário</label>
            <select value={form.regimeTributario} onChange={(e) => set({ regimeTributario: Number(e.target.value) })} className={input}>
              <option value={1}>Simples Nacional</option>
              <option value={2}>Simples Nacional — excesso de sublimite</option>
              <option value={3}>Regime Normal (Presumido/Real)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">E-mail</label>
            <input value={form.email} onChange={(e) => set({ email: e.target.value })} className={input} />
          </div>
        </div>
      </section>

      {/* Endereço */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-card">
        <h2 className="font-semibold">Endereço</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-neutral-700">CEP</label>
            <input value={form.cep} onChange={(e) => set({ cep: e.target.value })} onBlur={lookupCep} placeholder="00000-000" className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-neutral-700">Logradouro</label>
            <input value={form.logradouro} onChange={(e) => set({ logradouro: e.target.value })} className={input} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Número</label>
            <input value={form.numero} onChange={(e) => set({ numero: e.target.value })} className={input} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Bairro</label>
            <input value={form.bairro} onChange={(e) => set({ bairro: e.target.value })} className={input} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Complemento</label>
            <input value={form.complemento} onChange={(e) => set({ complemento: e.target.value })} className={input} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Município</label>
            <input value={form.municipio} onChange={(e) => set({ municipio: e.target.value })} className={input} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">UF</label>
            <input value={form.uf} onChange={(e) => set({ uf: e.target.value })} maxLength={2} className={input} />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-700">Cód. município (IBGE)</label>
            <input value={form.codigoMunicipio} onChange={(e) => set({ codigoMunicipio: e.target.value })} className={input} />
          </div>
        </div>
      </section>

      {/* Emissão */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-card">
        <h2 className="font-semibold">Emissão</h2>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <div>
            <label className="block text-sm font-medium text-neutral-700">Ambiente</label>
            <select value={form.ambiente} onChange={(e) => set({ ambiente: e.target.value })} className={input}>
              <option value="homologacao">Homologação (teste)</option>
              <option value="producao">Produção (nota real)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={form.habilitaNfce} onChange={(e) => set({ habilitaNfce: e.target.checked })} className="h-4 w-4 rounded border-neutral-300" />
            Habilitar NFC-e
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={form.habilitaNfe} onChange={(e) => set({ habilitaNfe: e.target.checked })} className="h-4 w-4 rounded border-neutral-300" />
            Habilitar NF-e
          </label>
        </div>
        <details className="mt-4 rounded-lg border border-neutral-200 p-3">
          <summary className="cursor-pointer text-sm font-medium text-neutral-700">
            CSC da NFC-e (só pra produção)
          </summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-neutral-600">CSC (token)</label>
              <input value={form.cscNfceProd} onChange={(e) => set({ cscNfceProd: e.target.value })} className={input} />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600">ID do token CSC</label>
              <input value={form.idTokenNfceProd} onChange={(e) => set({ idTokenNfceProd: e.target.value })} className={input} />
            </div>
          </div>
          <p className="mt-2 text-xs text-neutral-400">
            Gerado no site da SEFAZ do seu estado. Necessário só pra emitir NFC-e em produção.
          </p>
        </details>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={saveConfig}
            disabled={isPending}
            className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-400"
          >
            {isPending ? "Salvando..." : "Salvar dados"}
          </button>
        </div>
      </section>

      {/* Certificado */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-card">
        <h2 className="font-semibold">Certificado digital A1</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Envie o arquivo <strong>.pfx</strong> (ou .p12) + a senha. Ele vai direto pro Focus NFe — o
          sistema <strong>não guarda</strong> o arquivo nem a senha. Salve os dados da empresa antes.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".pfx,.p12,application/x-pkcs12"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              {certName || "Escolher arquivo .pfx"}
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600">Senha do certificado</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className={input}
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            onClick={sendCert}
            disabled={isPending || !certBase64}
            className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-400"
          >
            {isPending ? "Enviando..." : "Enviar certificado"}
          </button>
        </div>

        <details className="mt-5 border-t border-neutral-100 pt-4">
          <summary className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-600">
            Já uso o Focus com essa empresa? (migração)
          </summary>
          <p className="mt-2 text-sm text-neutral-500">
            Se essa empresa <strong>já está cadastrada no Focus</strong> (com certificado), vincule sem
            reenviar o arquivo — o sistema puxa os tokens pelo CNPJ.
          </p>
          <button
            type="button"
            onClick={linkExisting}
            disabled={isPending}
            className="mt-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            Vincular empresa já cadastrada no Focus
          </button>
        </details>
      </section>

      {/* Logo no DANFE */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-card">
        <h2 className="font-semibold">Logo no cupom/DANFE</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Usa a <strong>logo da loja</strong> (subida em Configurações → Identidade visual) na nota
          fiscal. Envie depois de cadastrar/vincular a empresa. PNG até 200×200 fica melhor.
        </p>
        <button
          type="button"
          onClick={syncLogo}
          disabled={isPending}
          className="mt-3 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
        >
          Enviar logo da loja pro Focus
        </button>
      </section>
    </main>
  );
}
