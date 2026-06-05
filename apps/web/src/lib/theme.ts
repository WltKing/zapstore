// Motor de tema white-label: a partir de 1 cor primária (escolhida pelo lojista),
// deriva a paleta e a cor de texto (preto/branco) por contraste. Gera as
// variáveis CSS injetadas no layout. Sem dependência externa.

const DEFAULT = "#171717"; // neutro (igual ao visual atual quando não há cor)

function clampHex(hex?: string | null): string {
  if (!hex) return DEFAULT;
  const h = hex.trim();
  return /^#[0-9a-fA-F]{6}$/.test(h) ? h : DEFAULT;
}

function toRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}
function toHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
/** Mistura `hex` com `target` (#fff/#000) numa proporção 0..1. */
function mix(hex: string, target: string, ratio: number): string {
  const [r1, g1, b1] = toRgb(hex);
  const [r2, g2, b2] = toRgb(target);
  return toHex(r1 + (r2 - r1) * ratio, g1 + (g2 - g1) * ratio, b1 + (b2 - b1) * ratio);
}
/** Luminância relativa (0 escuro … 1 claro) p/ decidir texto preto ou branco. */
function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export interface BrandTheme {
  base: string;
  fg: string; // texto sobre a cor primária
  hover: string; // estado hover do botão primário
  soft: string; // fundo suave (itens selecionados, realces)
  softFg: string; // texto sobre o fundo suave
  overlay: string; // camada p/ item ativo sobre a cor (translúcida)
  overlaySoft: string; // camada p/ hover sobre a cor
}

export function brandTheme(hex?: string | null): BrandTheme {
  const base = clampHex(hex);
  const light = luminance(base) > 0.55;
  const fg = light ? "#171717" : "#ffffff";
  // Camadas translúcidas pro item ativo/hover na lateral colorida: clareiam se a
  // cor é escura (texto branco), escurecem se a cor é clara (texto preto).
  const fgIsWhite = fg === "#ffffff";
  return {
    base,
    fg,
    hover: light ? mix(base, "#000000", 0.1) : mix(base, "#000000", 0.18),
    soft: mix(base, "#ffffff", 0.9),
    softFg: mix(base, "#000000", luminance(base) > 0.7 ? 0.55 : 0.25),
    overlay: fgIsWhite ? "rgba(255,255,255,0.20)" : "rgba(0,0,0,0.12)",
    overlaySoft: fgIsWhite ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.06)",
  };
}

/** String CSS pra injetar num <style> (:root) com as variáveis da marca. */
export function brandCssVars(hex?: string | null): string {
  const t = brandTheme(hex);
  return `:root{--brand:${t.base};--brand-fg:${t.fg};--brand-hover:${t.hover};--brand-soft:${t.soft};--brand-soft-fg:${t.softFg};--brand-overlay:${t.overlay};--brand-overlay-soft:${t.overlaySoft};}`;
}
