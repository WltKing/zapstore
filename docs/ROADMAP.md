# Zapstore — Roadmap do Produto Completo

> Objetivo: um SaaS multi-tenant que dá ao lojista **(1)** um atendente virtual de WhatsApp
> que faz tudo (atende, vende, agenda, cancela) e **(2)** um sistema de gestão completo —
> com a abrangência do Sistema 2.0 (SleepZ) + venda de serviços + multi-nicho.
>
> Base de referência: Sistema 2.0 do SleepZ (PHP+Postgres+n8n), catalogado em 2026-05-29.
> Este documento é o inventário completo + plano de fases. Atualizar conforme avança.

---

## Legenda de status
- ✅ Pronto (Fase 1, em produção)
- 🟡 Parcial (existe versão básica)
- ⬜ A fazer

---

## MÓDULOS DO PRODUTO (inventário completo)

### M1 — Núcleo SaaS / Multi-tenant
| Função | Status |
|---|---|
| Cadastro de loja (tenant) + onboarding | ✅ |
| Multi-tenant com Row-Level Security | ✅ |
| Login (magic link) | ✅ |
| Assinatura Asaas + trial | ✅ |
| Medidor de mensagens (cota) + alertas 80/100% | ✅ |
| E-mail real (Resend) pros clientes | ⬜ |
| Multi-usuário por loja com perfis (adm/vendedor/entregador/financeiro) | ⬜ |
| Pacotes extras de mensagens / upgrade de plano | ⬜ |
| Webhook de pagamento (ativa assinatura ao pagar) | ⬜ |

### M2 — Atendente Virtual (Bot) — o coração do produto
| Função | Status |
|---|---|
| Recebe/responde texto via WhatsApp (Evolution) | ✅ |
| Engine LLM (Gemini) com prompt por nicho | ✅ |
| Tool: criar pedido | ✅ |
| Configurador do bot (campos + instruções extras) | ✅ |
| Simulador de chat no painel | ✅ |
| Entende **áudio** (transcrição Whisper) | ⬜ |
| Entende **imagem** (visão — cliente manda foto) | ⬜ |
| Entende **PDF** (comprovante, lista) | ⬜ |
| Buffer de mensagens (consolida msgs rápidas) | ⬜ |
| Detecta atendente humano → pausa bot 24h | ⬜ |
| Opt-out (cliente pede pra parar) | ⬜ |
| Resposta dividida em blocos + delays humanizados | ⬜ |
| Tools: atualizar pedido, cancelar pedido | ⬜ |
| Tool: consultar vagas de entrega | ⬜ |
| Tools de agendamento (ver M5) | ⬜ |
| Notifica time interno (grupo WhatsApp) em eventos | ⬜ |
| Reconhece pedido do catálogo nativo do WhatsApp | ⬜ |

### M3 — Vendas / Pedidos
| Função | Status |
|---|---|
| Lista de pedidos + status | ✅ |
| Criar pedido (básico, via bot/tool) | 🟡 |
| Form de pedido completo (manual no painel) | ⬜ |
| Cliente: autocomplete de recorrentes | ⬜ |
| Endereço: CEP + Google Maps + IBGE | ⬜ |
| Itens: desconto, frete e pagamento por item | ⬜ |
| Tipo de venda (online/presencial), "a receber" | ⬜ |
| Editar pedido / modal de detalhes | ⬜ |
| Impressão do pedido (com QR Pix) | ⬜ |

### M4 — Produtos & Estoque
| Função | Status |
|---|---|
| CRUD de produto (nome, preço, foto, estoque) | ✅ |
| Nome técnico (NF) vs nome comercial (bot) | ⬜ |
| Categorias (solteiro/casal/queen… ou por nicho) | ⬜ |
| Kits / composição de conjunto | ⬜ |
| Margem padrão + aplicar margem em lote | ⬜ |
| Alerta de estoque baixo | ⬜ |
| Dados fiscais (NCM, CEST, CFOP, origem) | ⬜ |
| Importar XML de NFe (cadastra produto + fiscal) | ⬜ |

### M5 — Agendamento de Serviços (NOVO — nem o SleepZ tem)
| Função | Status |
|---|---|
| Cadastro de profissionais | ⬜ |
| Cadastro de serviços (duração, preço) | ⬜ |
| Grade de horários / disponibilidade | ⬜ |
| Bot agenda / remarca / cancela | ⬜ |
| Calendário visual no painel | ⬜ |
| Lembretes automáticos (24h / 2h antes) | ⬜ |
| Política de cancelamento | ⬜ |

### M6 — Financeiro
| Função | Status |
|---|---|
| Despesas (categorias, forma, PDF) | ⬜ |
| Competência (vendas brutas por data do pedido) | ⬜ |
| Caixa (entrou/saiu, filtros) | ⬜ |
| Fechamento do dia | ⬜ |
| Cards do dia (vendido, recebido, a entregar, resultado) | ⬜ |
| Formas de pagamento + taxas de maquininha | ⬜ |
| Parcelamento de cartão (taxa por parcela) | ⬜ |
| Crédito a cair D+1 (antecipação de recebíveis) | ⬜ |
| Antecipação de parcelas + métricas | ⬜ |
| Imposto estimado (alíquota Simples) | ⬜ |

### M7 — Fiscal / NFe
| Função | Status |
|---|---|
| Integração Focus NFe (multi-tenant, certificado A1) | ⬜ |
| Emitir NFC-e (cupom) | ⬜ |
| Emitir NF-e (nota completa) | ⬜ |
| Emissão automática na entrega (por forma de pgto) | ⬜ |
| Cancelar nota | ⬜ |

### M8 — Logística / Entregas
| Função | Status |
|---|---|
| Capacidade por turno (vagas dia útil/sáb/dom) | ⬜ |
| Consulta de vagas (painel + bot) | ⬜ |
| Rota do dia (tela do motorista) | ⬜ |
| Gestão de entregas (filtrar, status) | ⬜ |
| Reagendar / pular entrega | ⬜ |
| Feriados (expediente de entrega) | ⬜ |
| Banner de entregas atrasadas | ⬜ |
| App do motorista (PWA) | ⬜ |

### M9 — Marketing / BI
| Função | Status |
|---|---|
| Investimento em ads (Meta/Google) | ⬜ |
| ROAS, CAC, ticket médio online | ⬜ |
| Funil por canal (leads→vendas→conversão) | ⬜ |
| Registro e origem de leads | ⬜ |
| Raio de atuação (top cidades / bairros) | ⬜ |
| Projeção (média móvel 3 meses) | ⬜ |

### M10 — Remarketing automático (do fluxo n8n atual)
| Função | Status |
|---|---|
| Cron de remarketing (dias úteis, horário) | ⬜ |
| Leads sem resposta 24h (msg A) / 72h (msg B) | ⬜ |
| Templates A/B editáveis pelo lojista | ⬜ |
| Filtros: opt-out, bloqueado, comprou 90d | ⬜ |
| Rate limiting (X disparos/execução) | ⬜ |

### M11 — Dashboard / Relatórios
| Função | Status |
|---|---|
| 4 cards básicos + uso de mensagens | ✅ |
| KPIs ricos (vendas brutas, líquidas, a receber) | ⬜ |
| Vendas por canal (online/presencial) | ⬜ |
| Vendas por login/vendedor | ⬜ |
| Formas de pagamento + distribuição | ⬜ |
| Top produtos, performance semanal | ⬜ |
| Evolução 12 meses | ⬜ |
| Exportar CSV (vendas, despesas, unificado) | ⬜ |
| Backup / restore | ⬜ |

### M12 — Administração & Plataforma
| Função | Status |
|---|---|
| Configurações por loja | 🟡 |
| Perfis de usuário e permissões | ⬜ |
| Auditoria (bot, ações) | ⬜ |
| Templates prontos por nicho | 🟡 (3 prompts) |
| Realtime (atualização ao vivo do painel) | ⬜ |
| White-label (plano premium) | ⬜ |

---

## ESTRATÉGIA DE EXECUÇÃO: largura primeiro, profundidade depois

Decisão (2026-05-29): em vez de aprofundar um módulo por vez, fazer o **sistema
inteiro existir de forma básica** primeiro (todas as áreas funcionando no simples),
e depois aprofundar com detalhes/funções avançadas. Vantagens: "sistema completo"
pra demonstrar e vender muito antes; cada área já dá valor; incrementos guiados por
feedback real. Ritmo: cada CAMADA é construída inteira e entregue pra validação.

---

### CAMADA 0 ✅ FEITA — Fundação + prova de conceito
Núcleo SaaS + bot de texto + pedidos/produtos básicos + dashboard simples + billing.
Em produção em zapstore.sleepzcolchoes.com.

### CAMADA 1 — "Sistema completo, versão básica" (PRÓXIMA)
Todas as áreas existindo e funcionais no simples. Entregue inteira pra validar.
1. **Shell de navegação** — sidebar com todas as áreas agrupadas (Principal/Financeiro/
   Logística/Serviços/Sistema), igual ao SleepZ. Dá a cara de "sistema completo".
2. **Clientes (CRM básico)** — cadastro/lista, telefone, endereço, histórico simples.
3. **Pedidos** — criar manual no painel (form), editar, ver detalhes (além do bot).
4. **Produtos** — categorias, alerta de estoque baixo, margem simples.
5. **Agendamento** — profissionais, serviços, agenda, agendar/cancelar manual + via bot.
6. **Financeiro básico** — despesas (categorias) + caixa simples (entradas das vendas −
   despesas) + visão de competência.
7. **Entregas básico** — lista de entregas, status, capacidade por turno simples.
8. **Dashboard melhor** — cards ricos (vendas, líquido, pedidos, mensagens) + 2-3 gráficos.
9. **Configurações ampliadas** — horário, pagamento, entrega, dados da loja num só lugar.
10. **Usuários & perfis** — multi-usuário por loja (adm/operador) básico.
11. **Bot — incrementos essenciais** — tools cancelar e atualizar pedido; entender áudio.
12. **E-mail real (Resend)** — clientes logam sozinhos.

### CAMADA 2 — Profundidade comercial (vender melhor)
- Bot completo: imagem, PDF, buffer, pausa humano, opt-out, resposta humanizada, notificar time
- Agendamento: lembretes automáticos, calendário visual, política de cancelamento
- Pedidos: autocomplete cliente, CEP+Maps+IBGE, desconto/frete por item, impressão com QR Pix
- Remarketing automático (cron, A/B, opt-out)
- Dashboard/BI: vendas por canal/vendedor, top produtos, evolução 12m, exportar CSV

### CAMADA 3 — Profundidade operacional (loja grande)
- Financeiro avançado: formas+taxas maquininha, parcelamento, crédito D+1, antecipação, imposto
- Logística: rota do motorista, reagendar/pular, feriados, app motorista PWA, atrasadas
- Produtos: kits/composição, import XML de NFe, dados fiscais

### CAMADA 4 — Fiscal & Marketing & Plataforma
- Fiscal: Focus NFe multi-tenant (NFC-e/NF-e, emissão automática na entrega)
- Marketing/BI: ROAS, CAC, funil Meta/Google, raio de atuação, projeções
- Plataforma: auditoria, realtime, white-label, templates por nicho, app mobile

---

## Notas de produto
- Nem tudo precisa ser idêntico ao SleepZ. Ex.: o que é específico de colchão (categorias) vira
  configurável por nicho. NFe pode ser opcional por lojista (muitos MEI nem emitem).
- Ordem das fases é sugestão — priorizar pelo que vende mais rápido. O atendente virtual completo
  (Fase 2) é o coração; agendamento (Fase 3) abre nichos novos.
- Multi-tenant exige: tudo com `tenant_id` + RLS, e o que é "config do SleepZ" (taxas, feriados,
  capacidade, fiscal) vira config por tenant.
