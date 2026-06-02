"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeUserRoleAction, inviteUserAction, removeUserAction } from "@/lib/actions/users";
import { ROLES, ROLE_LABELS } from "@/lib/roles";

interface UserRow {
  userId: string;
  email: string;
  role: string;
  verified: boolean;
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
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{storeName}</p>
          <h1 className="text-3xl font-bold tracking-tight">Usuários</h1>
        </div>
        <a
          href="/dashboard"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Voltar
        </a>
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
          <section className="mt-8 rounded-2xl bg-white p-6 shadow-sm">
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
                  className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700">Perfil</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
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
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:bg-neutral-400"
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
          <section className="mt-6 rounded-2xl bg-white shadow-sm">
            <table className="w-full">
              <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-6 py-3 text-left">Usuário</th>
                  <th className="px-6 py-3 text-left">Perfil</th>
                  <th className="px-6 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const self = u.userId === currentUserId;
                  return (
                    <tr key={u.userId} className="border-b border-neutral-100 last:border-0">
                      <td className="px-6 py-4">
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
                      <td className="px-6 py-4">
                        <select
                          value={u.role}
                          disabled={self || isPending}
                          onChange={(e) => run(() => changeUserRoleAction(u.userId, e.target.value))}
                          className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm shadow-sm focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 disabled:bg-neutral-50 disabled:text-neutral-400"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {self ? (
                          <span className="text-xs text-neutral-400">—</span>
                        ) : (
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
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <p className="mt-4 text-xs text-neutral-500">
            <strong>Perfis:</strong> Administrador (tudo, inclui equipe e assinatura) · Operador
            (dia a dia: pedidos, agenda) · Financeiro (caixa, despesas) · Entregador (entregas). A
            restrição fina por perfil será aprofundada nas próximas camadas.
          </p>
        </>
      )}
    </main>
  );
}
