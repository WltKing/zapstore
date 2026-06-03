// Gera o "Pix Copia e Cola" (BR Code / EMV) a partir da chave do lojista.
// Sem gateway: é só um código padronizado que o pagador escaneia e o dinheiro
// vai direto pra conta do lojista.

function tlv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Remove acentos/caracteres não-ASCII e limita o tamanho (exigência do BR Code). */
function sanitize(s: string, max: number): string {
  // normalize("NFD") separa acento da letra; o filtro ASCII abaixo remove o acento.
  return s
    .normalize("NFD")
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, max);
}

export function buildPixPayload(opts: {
  key: string;
  merchantName: string;
  merchantCity: string;
  amount?: number;
  txid?: string;
}): string {
  const merchantAccount = tlv("26", tlv("00", "br.gov.bcb.pix") + tlv("01", opts.key.trim()));
  const name = sanitize(opts.merchantName || "RECEBEDOR", 25);
  const city = sanitize(opts.merchantCity || "BRASIL", 15);
  const txid = sanitize(opts.txid || "***", 25) || "***";

  let payload =
    tlv("00", "01") +
    merchantAccount +
    tlv("52", "0000") +
    tlv("53", "986") +
    (opts.amount && opts.amount > 0 ? tlv("54", opts.amount.toFixed(2)) : "") +
    tlv("58", "BR") +
    tlv("59", name) +
    tlv("60", city) +
    tlv("62", tlv("05", txid)) +
    "6304";
  payload += crc16(payload);
  return payload;
}
