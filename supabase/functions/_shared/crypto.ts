// AES-GCM helper para credenciais por tenant (Fase 3).
// Cifra/decifra strings usando INTEGRATION_CRYPTO_KEY (segredo runtime).
// Formato armazenado: base64( iv(12) || ciphertext+tag )

const ENC_KEY_ENV = "INTEGRATION_CRYPTO_KEY";

async function importKey(): Promise<CryptoKey> {
  const raw = Deno.env.get(ENC_KEY_ENV);
  if (!raw) throw new Error("INTEGRATION_CRYPTO_KEY not configured");
  // Aceita base64 ou string longa; deriva 32 bytes via SHA-256.
  const bytes = new TextEncoder().encode(raw);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return await crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function b64encode(buf: Uint8Array): string {
  let s = "";
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s);
}
function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function encryptSecret(plain: string): Promise<string> {
  if (!plain) return "";
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain)),
  );
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return b64encode(out);
}

export async function decryptSecret(payload: string | null | undefined): Promise<string> {
  if (!payload) return "";
  const key = await importKey();
  const buf = b64decode(payload);
  const iv = buf.slice(0, 12);
  const ct = buf.slice(12);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}