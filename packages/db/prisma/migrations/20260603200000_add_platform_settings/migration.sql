-- Configurações globais da plataforma (chaves de API) — super-admin.
-- Global (sem tenantId/RLS). Lida por getPlatformSetting() com fallback pro env.

CREATE TABLE "platform_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);
