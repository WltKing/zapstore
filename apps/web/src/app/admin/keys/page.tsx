import { prisma } from "@zapstore/db";
import { PLATFORM_KEYS, maskSecret } from "@/lib/platform-keys";
import { KeysView, type KeyRow } from "./view";

export const dynamic = "force-dynamic";

export default async function AdminKeysPage() {
  const rows = await prisma.platformSetting.findMany();
  const dbMap = new Map(rows.map((r) => [r.key, r.value]));

  const keys: KeyRow[] = PLATFORM_KEYS.map((k) => {
    const dbVal = dbMap.get(k.key) ?? null;
    const envVal = process.env[k.key] ?? null;
    const effective = dbVal ?? envVal;
    return {
      key: k.key,
      label: k.label,
      help: k.help,
      group: k.group,
      masked: maskSecret(effective),
      source: dbVal ? "banco" : envVal ? "ambiente" : "nao_definido",
    };
  });

  return <KeysView keys={keys} />;
}
