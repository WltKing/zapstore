"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteUserAction, removeUserAction, setUserAccessAction } from "@/lib/actions/users";
import { ROLE_LABELS } from "@/lib/roles";
import {
  AREAS,
  AREA_LABELS,
  isCustom,
  PRESET_ROLES,
  CUSTOM_TEMPLATES,
  ROLE_PERMISSIONS,
  ADMIN_ONLY_AREAS,
} from "@/lib/permissions";

// Áreas que aparecem no seletor de Personalizado (tira as exclusivas do dono).
const PICKABLE_AREAS = AREAS.filter((a) => !ADMIN_ONLY_AREAS.includes(a));

interface UserRow {
  userId: string;
  email: string;
  role: string;
  permissions: string[] | null;
  verified: boolean;
}

/** Rótulo do perfil pronto, na ordem que a UI usa hoje. */
function presetLabel(role: string): string {
  return ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role;
}

function accessLabel(u: UserRow): string {
  if (isCustom(u.permissions)) return "Personalizado";
  return presetLabel(u.role);
}

export function UsersView({
  storeName,
  isAdmin,
  currentUserId,
  users,
}: {
  storeName: string;
  isAdmin: boolean;
  currentUserId: string;
  users: UserRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("CUSTOM");
  const [invitePerms, setInvitePerms] = useState<string[]>([...CUSTOM_TEMPLATES[0].areas]);
  const [editing, setEditing] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Erro");
      else router.refresh();
    });
  };

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const r = await inviteUserAction({
        email: inviteEmail,
        role: inviteRole,
        permissions: inviteRole === "CUSTOM" ? invitePerms : null,
      });
      if (r.ok) setInviteEmail("");
      return r;
    });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
        </div>
        </header>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {!isAdmin ? (
        <div className="mt-8 rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
          <div className="text-3xl">🔒</div>
          <h2 className="mt-2 text-lg font-semibold">Acesso restrito</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
            Só o administrador da loja pode gerenciar a equipe e os perfis de acesso.
          </p>
        </div>
      ) : (
        <>
          {/* Convidar */}
          <section className="mt-8 rounded-2xl bg-white p-5 shadow-card sm:p-6">
            <h2 className="font-semibold">Convidar para a equipe</h2>
            <form onSubmit={invite} className="mt-4 space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-full min-w-0 flex-1 sm:w-auto">
                  <label className="block text-sm font-medium text-neutral-700">E-mail</label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="pessoa@email.com"
                    className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700">Perfil</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                  >
                    {PRESET_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {presetLabel(r)}
                      </option>
                    ))}
                    <option value="CUSTOM">Personalizado</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-400"
                >
                  Convidar
                </button>
              </div>

              {inviteRole === "CUSTOM" && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 sm:p-4">
                  <p className="mb-3 text-xs text-neutral-500">
                    Comece por um modelo e ajuste as áreas que essa pessoa pode acessar:
                  </p>
                  <AreaPicker checked={invitePerms} setChecked={setInvitePerms} />
                </div>
              )}
            </form>
            <p className="mt-3 text-xs text-neutral-500">
              A pessoa acessa em <strong>/login</strong> com esse e-mail (o link de acesso é enviado
              por e-mail). Hoje o envio só chega no seu próprio e-mail — pra mandar a outros, verifique
              o domínio no provedor de e-mail.
            </p>
          </section>

          {/* Lista (cards que empilham no mobile: e-mail em cima, perfil + ações embaixo) */}
          <section className="mt-6 divide-y divide-neutral-100 rounded-2xl bg-white shadow-card">
            {users.map((u) => {
              const self = u.userId === currentUserId;
              return (
                <div key={u.userId}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-4 sm:px-6">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{u.email}</span>
                        {self && (
                          <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                            VOCÊ
                          </span>
                        )}
                      </div>
                      {!u.verified && (
                        <div className="text-xs text-amber-600">Convite pendente (ainda não acessou)</div>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
                      {accessLabel(u)}
                    </span>
                    {!self && (
                      <div className="flex shrink-0 items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setEditing(editing === u.userId ? null : u.userId)}
                          className="text-sm text-neutral-600 hover:text-neutral-900"
                        >
                          {editing === u.userId ? "Fechar" : "Editar acesso"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Remover ${u.email} da loja?`)) run(() => removeUserAction(u.userId));
                          }}
                          disabled={isPending}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Remover
                        </button>
                      </div>
                    )}
                  </div>
                  {editing === u.userId && !self && (
                    <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-4 sm:px-6">
                      <AccessEditor
                        user={u}
                        disabled={isPending}
                        onSave={(role, permissions) => {
                          run(async () => {
                            const r = await setUserAccessAction(u.userId, { role, permissions });
                            if (r.ok) setEditing(null);
                            return r;
                          });
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          <p className="mt-4 text-xs leading-relaxed text-neutral-500">
            <strong>Administrador</strong> faz tudo. <strong>Gerente</strong> opera o dia a dia.{" "}
            <strong>Personalizado</strong>: você marca as áreas. Finanças, fiscal, configurações e bot
            são só do dono.
          </p>
        </>
      )}
    </main>
  );
}

/** Seletor de áreas (modelos de partida + grade de marcação). "Visão geral" é sempre incluída. */
function AreaPicker({
  checked,
  setChecked,
}: {
  checked: string[];
  setChecked: (areas: string[]) => void;
}) {
  const toggle = (area: string) =>
    setChecked(checked.includes(area) ? checked.filter((a) => a !== area) : [...checked, area]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-neutral-500">Modelos:</span>
        {CUSTOM_TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setChecked(t.areas.filter((a) => !ADMIN_ONLY_AREAS.includes(a)))}
            className="rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-medium text-neutral-700 hover:border-brand hover:text-brand"
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PICKABLE_AREAS.map((area) => {
          const isDash = area === "dashboard";
          const on = isDash || checked.includes(area);
          return (
            <label
              key={area}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                on ? "border-neutral-400 bg-white" : "border-neutral-200 bg-neutral-50"
              } ${isDash ? "opacity-60" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                checked={on}
                disabled={isDash}
                onChange={() => toggle(area)}
                className="h-4 w-4 shrink-0 rounded border-neutral-300"
              />
              <span className="min-w-0">{AREA_LABELS[area]}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function AccessEditor({
  user,
  disabled,
  onSave,
}: {
  user: UserRow;
  disabled: boolean;
  onSave: (role: string, permissions: string[] | null) => void;
}) {
  const startCustom = isCustom(user.permissions);
  // Perfil pronto antigo (Vendedor/Financeiro/Entregador) que saiu do seletor:
  // abre já no modo Personalizado, com as áreas do preset marcadas pra ajustar.
  const legacyPreset = !startCustom && !PRESET_ROLES.includes(user.role as never);
  const [mode, setMode] = useState<string>(startCustom || legacyPreset ? "CUSTOM" : user.role);
  const [checked, setChecked] = useState<string[]>(
    startCustom
      ? user.permissions ?? ["dashboard"]
      : legacyPreset
        ? [...(ROLE_PERMISSIONS[user.role as keyof typeof ROLE_PERMISSIONS] ?? ["dashboard"])]
        : ["dashboard"],
  );

  const save = () => {
    if (mode === "CUSTOM") onSave("OPERATOR", checked.length ? checked : ["dashboard"]);
    else onSave(mode, null);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-neutral-700">Perfil:</label>
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm shadow-card focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          {PRESET_ROLES.map((r) => (
            <option key={r} value={r}>
              {presetLabel(r)}
            </option>
          ))}
          <option value="CUSTOM">Personalizado</option>
        </select>
        <button
          type="button"
          onClick={save}
          disabled={disabled}
          className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-400"
        >
          Salvar acesso
        </button>
      </div>

      {mode === "CUSTOM" && <AreaPicker checked={checked} setChecked={setChecked} />}
    </div>
  );
}
