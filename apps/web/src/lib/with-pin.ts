"use client";

// Chama uma action de gestão; se o servidor pedir a senha de gestão, pergunta
// (prompt) e repete a chamada. Loja sem senha configurada nunca vê o prompt.

const PIN_MARKER = "Senha de gestão";

export async function callWithPin<T extends { ok: boolean; error?: string }>(
  call: (pin?: string) => Promise<T>,
): Promise<T> {
  let result = await call(undefined);
  while (!result.ok && result.error?.includes(PIN_MARKER)) {
    const pin = window.prompt("Digite a senha de gestão da loja:");
    if (pin === null || pin === "") return result; // cancelou
    result = await call(pin);
    if (result.ok) break;
    if (!result.error?.includes(PIN_MARKER)) break;
    window.alert("Senha incorreta — tente de novo.");
  }
  return result;
}
