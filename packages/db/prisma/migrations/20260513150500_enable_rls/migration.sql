-- Row-Level Security para isolamento multi-tenant.
--
-- Esta migration roda DEPOIS da init (20260513150422_init) que criou as tabelas.
-- Cada conexao precisa setar app.tenant_id no inicio da transacao:
--   SET LOCAL app.tenant_id = '<uuid-do-tenant>';
-- O helper withTenant() em packages/db/src faz isso automaticamente.
--
-- NOTA: os nomes de colunas estao em camelCase porque o Prisma nao tem @map
-- nelas. Por isso uso aspas duplas: "tenantId".

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

CREATE POLICY tenant_isolation_products ON products
  USING ("tenantId" = current_tenant_id());

CREATE POLICY tenant_isolation_orders ON orders
  USING ("tenantId" = current_tenant_id());

CREATE POLICY tenant_isolation_conversations ON conversations
  USING ("tenantId" = current_tenant_id());

CREATE POLICY tenant_isolation_usage_events ON usage_events
  USING ("tenantId" = current_tenant_id());

CREATE POLICY tenant_isolation_bot_configs ON bot_configs
  USING ("tenantId" = current_tenant_id());

CREATE POLICY tenant_isolation_subscriptions ON subscriptions
  USING ("tenantId" = current_tenant_id());

CREATE POLICY tenant_isolation_messages ON messages
  USING (
    "conversationId" IN (
      SELECT id FROM conversations WHERE "tenantId" = current_tenant_id()
    )
  );
