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

/**
 * Igual ao callWithPin, mas DEVOLVE o PIN usado quando dá certo — pra "pedir a
 * senha ANTES de abrir a edição" e reaproveitar o mesmo PIN ao salvar (sem pedir
 * 2×). Loja sem senha → ok com pin undefined (nunca mostra prompt).
 */
export async function requestPin(
  verify: (pin?: string) => Promise<{ ok: boolean; error?: string }>,
): Promise<{ ok: boolean; pin?: string; error?: string }> {
  let result = await verify(undefined);
  if (result.ok) return { ok: true, pin: undefined };
  let pin: string | undefined;
  while (!result.ok && result.error?.includes(PIN_MARKER)) {
    const entered = window.prompt("Digite a senha de gestão da loja:");
    if (entered === null || entered === "") return { ok: false }; // cancelou
    pin = entered;
    result = await verify(pin);
    if (result.ok) return { ok: true, pin };
    if (!result.error?.includes(PIN_MARKER)) break;
    window.alert("Senha incorreta — tente de novo.");
  }
  return { ok: false, error: result.error };
}
