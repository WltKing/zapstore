-- Row-Level Security para isolamento multi-tenant.
--
-- Esta migration roda DEPOIS que `prisma migrate dev` cria as tabelas.
-- Aplica RLS em todas as tabelas que têm coluna tenant_id.
--
-- Cada conexão precisa setar app.tenant_id no início da transação:
--   SET LOCAL app.tenant_id = '<uuid-do-tenant>';
-- O helper withTenant() em packages/db/src faz isso automaticamente.

-- Habilita RLS nas tabelas de domínio
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Função helper que lê o tenant_id da sessão.
-- Retorna NULL se não estiver setada (queries falham por padrão = seguro).
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- Policies: cada linha só é visível se tenant_id casar com a sessão.
CREATE POLICY tenant_isolation_products ON products
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_orders ON orders
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_conversations ON conversations
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_usage_events ON usage_events
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_bot_configs ON bot_configs
  USING (tenant_id = current_tenant_id());

CREATE POLICY tenant_isolation_subscriptions ON subscriptions
  USING (tenant_id = current_tenant_id());

-- messages herda isolamento por conversa (conversa já é filtrada por tenant).
-- Mensagens não têm tenant_id direto, então a query precisa fazer JOIN com conversations.
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_messages ON messages
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE tenant_id = current_tenant_id()
    )
  );

-- IMPORTANTE: o usuário da aplicação NÃO deve ser superuser nem owner das tabelas
-- (superuser/owner ignora RLS). Em produção crie um role separado:
--   CREATE ROLE zapstore_app LOGIN PASSWORD '...';
--   GRANT USAGE ON SCHEMA public TO zapstore_app;
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO zapstore_app;
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO zapstore_app;
