/**
 * Gerador de payload PIX BR Code (EMV) — copia-e-cola estático.
 * Spec: Manual BR Code Banco Central + Manual de Padrões PIX (DICT).
 * CRC16-CCITT-FALSE (poly 0x1021, init 0xFFFF).
 */

const PIX_KEY_STORAGE = "sislac.pix.chave";
const PIX_MERCHANT_STORAGE = "sislac.pix.merchant";
const PIX_CITY_STORAGE = "sislac.pix.cidade";

export function getPixConfig() {
  return {
    chave: (localStorage.getItem(PIX_KEY_STORAGE) || "").trim(),
    merchant: (localStorage.getItem(PIX_MERCHANT_STORAGE) || "LABORATORIO").trim(),
    cidade: (localStorage.getItem(PIX_CITY_STORAGE) || "SAO PAULO").trim(),
  };
}

export function savePixConfig(cfg: { chave: string; merchant?: string; cidade?: string }) {
  localStorage.setItem(PIX_KEY_STORAGE, cfg.chave.trim());
  if (cfg.merchant) localStorage.setItem(PIX_MERCHANT_STORAGE, cfg.merchant.trim());
  if (cfg.cidade) localStorage.setItem(PIX_CITY_STORAGE, cfg.cidade.trim());
}

/** Remove acentos, força ASCII e upper. */
function sanitize(s: string, max: number) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "")
    .toUpperCase()
    .slice(0, max);
}

/** Field EMV: ID(2) + LEN(2) + VALUE */
function f(id: string, value: string) {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface PixPayloadInput {
  chave: string;             // chave PIX (CPF/CNPJ só dígitos, email, telefone +55..., EVP UUID)
  valor: number;             // em reais
  merchantName: string;      // até 25 chars
  merchantCity: string;      // até 15 chars
  txid?: string;             // até 25 chars, alfanumérico; default '***'
  descricao?: string;        // opcional, até ~50 chars
}

export function buildPixPayload(input: PixPayloadInput): string {
  const chave = input.chave.trim();
  if (!chave) throw new Error("Chave PIX não configurada.");

  const merchantName = sanitize(input.merchantName || "LABORATORIO", 25);
  const merchantCity = sanitize(input.merchantCity || "SAO PAULO", 15);
  const txid = sanitize(input.txid || "***", 25) || "***";

  // Merchant Account Information (ID 26) — PIX
  const gui = f("00", "BR.GOV.BCB.PIX");
  const key = f("01", chave);
  const desc = input.descricao ? f("02", sanitize(input.descricao, 50)) : "";
  const mai = f("26", gui + key + desc);

  const payloadFormat = f("00", "01");
  const merchantCategory = f("52", "0000");
  const currency = f("53", "986"); // BRL
  const amount = f("54", input.valor.toFixed(2));
  const country = f("58", "BR");
  const name = f("59", merchantName);
  const city = f("60", merchantCity);
  const addData = f("62", f("05", txid));

  const partial =
    payloadFormat + mai + merchantCategory + currency + amount + country + name + city + addData + "6304";

  return partial + crc16(partial);
}
