# Zapstore

SaaS de atendimento WhatsApp com IA para lojistas. Multi-tenant, escalavel, com cobranca por mensagens de IA.

> Status: Fase 0 (setup base) concluida. Em construcao.

## O que esta pronto

- Monorepo Turborepo com 3 apps (api, web, worker) e 4 pacotes (db, llm, whatsapp, payment).
- Schema PostgreSQL multi-tenant com Row-Level Security (isolamento por tenant).
- Esqueletos de provider para trocar fornecedor sem reescrever logica:
  - LLM: Anthropic (Claude Haiku 4.5) ou Google (Gemini Flash).
  - WhatsApp: Evolution API agora, Meta Cloud na Fase 4.
  - Pagamento: Asaas.
- API Fastify com endpoint `/health`.
- Worker BullMQ pronto para processar fila de mensagens.
- Frontend Next.js 15 + Tailwind.
- Docker Compose com Postgres 16 e Redis 7 prontos para rodar localmente.

## Como rodar localmente (passo a passo)

### 1. Pre-requisitos (ja instalados na sua maquina)
- Node.js 24 (instalado via winget)
- pnpm 11 (instalado via winget)
- Docker Desktop (instalado via winget — abrir manualmente uma vez para inicializar WSL2)
- Git (ja existia)

### 2. Configurar variaveis de ambiente
Copie o arquivo de exemplo:

```powershell
Copy-Item .env.example .env
```

Por enquanto nao precisa preencher chaves de API — o `/health` roda so com o banco.

### 3. Subir o banco e Redis em container
Abra o Docker Desktop primeiro (so na primeira vez para inicializar). Depois:

```powershell
pnpm docker:up
```

Isso sobe:
- Postgres em `localhost:5432` (user `zapstore`, senha `zapstore_dev`, banco `zapstore`)
- Redis em `localhost:6379`

### 4. Criar as tabelas no banco
```powershell
pnpm db:migrate
```

Da nome `init` quando perguntar. Isso cria todas as tabelas. Em seguida aplica a migracao SQL `00000000000000_init_rls` que ativa Row-Level Security.

### 5. Rodar a API
Em um terminal:

```powershell
pnpm --filter @zapstore/api dev
```

Teste em outro terminal:

```powershell
curl http://localhost:4000/health
```

Deve retornar `{"status":"ok"...}`.

### 6. Rodar o painel (frontend)
Em outro terminal:

```powershell
pnpm --filter @zapstore/web dev
```

Abra `http://localhost:3000`.

### 7. Rodar o worker
Em outro terminal:

```powershell
pnpm --filter @zapstore/worker dev
```

## Estrutura de pastas

```
saas/
├── apps/
│   ├── api/          API Fastify (endpoints HTTP, webhooks)
│   ├── web/          Painel do lojista (Next.js)
│   └── worker/       Processa fila de mensagens WhatsApp (BullMQ)
├── packages/
│   ├── db/           Prisma schema + RLS + helper withTenant
│   ├── llm/          Abstracao Claude/Gemini
│   ├── whatsapp/     Abstracao Evolution/Meta
│   └── payment/      Abstracao Asaas
├── docker-compose.dev.yml   Postgres + Redis para dev local
├── turbo.json               Orquestracao do monorepo
└── pnpm-workspace.yaml      Configuracao dos workspaces
```

## Comandos uteis

| Comando | O que faz |
|---|---|
| `pnpm install` | Instala dependencias de todos os apps/pacotes |
| `pnpm dev` | Roda todos os apps em modo dev (api + web + worker) |
| `pnpm build` | Compila tudo para producao |
| `pnpm typecheck` | Verifica tipos em todos os pacotes |
| `pnpm db:generate` | Regenera o Prisma Client (rodar apos mudar schema) |
| `pnpm db:migrate` | Cria nova migracao no banco |
| `pnpm db:studio` | Abre interface visual do banco (`localhost:5555`) |
| `pnpm docker:up` | Sobe Postgres + Redis |
| `pnpm docker:down` | Para os containers |

## Decisoes ja tomadas

- **Stack**: Node.js 22+ + TypeScript + Fastify + Prisma + Next.js 15
- **WhatsApp**: Evolution API agora; Meta Cloud na Fase 4 como upgrade pago
- **LLM padrao**: Claude Haiku 4.5; Gemini Flash como alternativa barata
- **Pagamento**: Asaas (PIX/boleto/cartao no Brasil)
- **Multi-tenant**: shared schema com Row-Level Security
- **Plano comercial**: R$ 299,90/mes = 2500 mensagens de IA
- **Excedente**: bot bloqueia (sistema continua), avisos em 80% e 100%

## Onde estao os documentos

- Plano completo das 5 fases: `C:\Users\welin\.claude\plans\c-users-welin-desktop-sistema-sistema-2-sequential-codd.md`
- Sistema antigo (SleepZ) — nao mexer: `C:\Users\welin\Desktop\Sistema\Sistema 2.0`

## Proximos passos (Fase 1 — MVP vendavel)

1. Criar conta no Asaas (sandbox) e gerar chave de API.
2. Criar conta no Anthropic e/ou Google AI Studio para chaves LLM.
3. Subir uma instancia Evolution API (Docker).
4. Implementar onboarding `/signup` no painel.
5. Implementar conexao WhatsApp via QR code.
6. Implementar configurador de bot (campos + simulador).
7. Implementar engine de conversa (recebe webhook -> LLM -> tools -> responde).
8. Implementar billing Asaas + webhook + medidor de mensagens.
9. Implementar dashboard com 4 cards.

Custo estimado dessa fase: ~R$ 90/mes de VPS (KVM 4 Hostinger) + R$ 0,008 por mensagem de IA do Claude Haiku 4.5.
