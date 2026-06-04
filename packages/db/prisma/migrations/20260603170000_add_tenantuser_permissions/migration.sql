-- Perfil personalizado: lista de áreas que o usuário pode acessar (JSON).
-- null/ausente = usa o preset do perfil (role). Aditivo.

ALTER TABLE "tenant_users" ADD COLUMN "permissions" JSONB;
