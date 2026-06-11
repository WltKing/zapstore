"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteUserAction, removeUserAction, setUserAccessAction } from "@/lib/actions/users";
import { ROLES, ROLE_LABELS } from "@/lib/roles";
import { AREAS, AREA_LABELS, isCustom } from "@/lib/permissions";

interface UserRow {
  userId: string;
  email: string;
  role: string;
  permissions: string[] | null;
  verified: boolean;
}

function accessLabel(u: UserRow): string {
  if (isCustom(u.permissions)) return "Personalizado";
  return ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role;
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
  const [inviteRole, setInviteRole] = useState<string>("OPERATOR");
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
      const r = await inviteUserAction({ email: inviteEmail, role: inviteRole });
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
          <section className="mt-8 rounded-2xl bg-white p-6 shadow-card">
            <h2 className="font-semibold">Convidar para a equipe</h2>
            <form onSubmit={invite} className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1">
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
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:bg-neutral-400"
              >
                Convidar
              </button>
            </form>
            <p className="mt-3 text-xs text-neutral-500">
              A pessoa acessa em <strong>/login</strong> com esse e-mail (o link de acesso é enviado
              por e-mail). Hoje o envio só chega no seu próprio e-mail — pra mandar a outros, verifique
              o domínio no provedor de e-mail.
            </p>
          </section>

          {/* Lista */}
          <section className="mt-6 rounded-2xl bg-white shadow-card">
            <table className="w-full">
              <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="py-3 pl-4 pr-2 text-left sm:px-4">Usuário</th>
                  <th className="px-2 py-3 text-left sm:px-4">Perfil</th>
                  <th className="py-3 pl-2 pr-4 text-right sm:px-4">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const self = u.userId === currentUserId;
                  return (
                    <Fragment key={u.userId}>
                      <tr className="border-b border-neutral-100 last:border-0">
                        <td className="py-3 pl-4 pr-2 sm:px-4 sm:py-4">
                          <div className="font-medium">
                            {u.email}
                            {self && (
                              <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
                                VOCÊ
                              </span>
                            )}
                          </div>
                          {!u.verified && (
                            <div className="text-xs text-amber-600">Convite pendente (ainda não acessou)</div>
                          )}
                        </td>
                        <td className="px-2 py-3 sm:px-4 sm:py-4">
                          <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">
                            {accessLabel(u)}
                          </span>
                        </td>
                        <td className="py-3 pl-2 pr-4 text-right sm:px-4 sm:py-4">
                          {self ? (
                            <span className="text-xs text-neutral-400">—</span>
                          ) : (
                            <div className="flex items-center justify-end gap-3">
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
                        </td>
                      </tr>
                      {editing === u.userId && !self && (
                        <tr className="border-b border-neutral-100 bg-neutral-50">
                          <td colSpan={3} className="px-6 py-4">
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
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </section>

          <p className="mt-4 text-xs text-neutral-500">
            <strong>Perfis prontos:</strong> Administrador (tudo, inclui equipe e assinatura) ·
            Operador (pedidos, produtos, clientes, agenda) · Financeiro (caixa, despesas, assinatura)
            · Entregador (rota, entregas, agenda). Ou escolha <strong>Personalizado</strong> e marque
            exatamente as áreas que a pessoa pode acessar.
          </p>
        </>
      )}
    </main>
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
  const [mode, setMode] = useState<string>(startCustom ? "CUSTOM" : user.role);
  const [checked, setChecked] = useState<string[]>(
    startCustom ? (user.permissions ?? []) : ["dashboard"],
  );

  const toggle = (area: string) =>
    setChecked((c) => (c.includes(area) ? c.filter((a) => a !== area) : [...c, area]));

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
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
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

      {mode === "CUSTOM" && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {AREAS.map((area) => {
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
                  className="h-4 w-4 rounded border-neutral-300"
                />
                {AREA_LABELS[area]}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
