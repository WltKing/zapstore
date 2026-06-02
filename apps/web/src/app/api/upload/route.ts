import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { randomUUID } from "node:crypto";
import { prisma } from "@zapstore/db";
import { auth } from "@/lib/auth";
import { isStorageConfigured, uploadToStorage } from "@/lib/storage";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const link = await prisma.tenantUser.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!link) return NextResponse.json({ error: "Sem loja cadastrada." }, { status: 403 });

  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "Upload de imagens ainda não configurado. Avise o suporte." },
      { status: 503 },
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Use JPG, PNG, WEBP ou GIF." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Imagem muito grande (máx 8MB)." }, { status: 400 });
  }

  const key = `tenants/${link.tenantId}/${randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    const url = await uploadToStorage(key, buf, file.type);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha no upload." },
      { status: 500 },
    );
  }
}
