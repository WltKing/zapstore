import { NextResponse, type NextRequest } from "next/server";

/**
 * Injeta o caminho atual num header (x-pathname) pra que o layout do painel
 * possa aplicar a trava de permissão por área (server component não recebe o
 * pathname de outra forma). Passthrough — não faz auth aqui.
 */
export function middleware(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Tudo exceto assets internos, api e arquivos estáticos.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};
