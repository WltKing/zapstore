import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma, withTenant } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { getPrimaryTenantForUser } from "@/lib/tenant";
import { FiscalView, type FiscalConfigData } from "./view";

export default async function FiscalPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const tenant = await getPrimaryTenantForUser(session.user.id);
  if (!tenant) redirect("/onboarding");

  const link = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id, tenantId: tenant.id },
    select: { role: true },
  });
  const isAdmin = link?.role === "ADMIN";

  const cfg = isAdmin
    ? await withTenant(tenant.id, (tx) => tx.fiscalConfig.findUnique({ where: { tenantId: tenant.id } }))
    : null;

  const data: FiscalConfigData | null = cfg
    ? {
        cnpj: cfg.cnpj,
        razaoSocial: cfg.razaoSocial,
        nomeFantasia: cfg.nomeFantasia,
        inscricaoEstadual: cfg.inscricaoEstadual,
        regimeTributario: cfg.regimeTributario,
        email: cfg.email,
        telefone: cfg.telefone,
        cep: cfg.cep,
        logradouro: cfg.logradouro,
        numero: cfg.numero,
        complemento: cfg.complemento,
        bairro: cfg.bairro,
        municipio: cfg.municipio,
        codigoMunicipio: cfg.codigoMunicipio,
        uf: cfg.uf,
        ambiente: cfg.ambiente,
        habilitaNfce: cfg.habilitaNfce,
        habilitaNfe: cfg.habilitaNfe,
        cscNfceProd: cfg.cscNfceProd,
        idTokenNfceProd: cfg.idTokenNfceProd,
        certStatus: cfg.certStatus,
        certCnpj: cfg.certCnpj,
        certValidoAte: cfg.certValidoAte ? cfg.certValidoAte.toISOString() : null,
        hasTokens: !!(cfg.focusTokenHomolog || cfg.focusTokenProd),
        enabled: cfg.enabled,
      }
    : null;

  return <FiscalView storeName={tenant.name} isAdmin={isAdmin} initial={data} />;
}
