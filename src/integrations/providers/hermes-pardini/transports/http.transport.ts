import type { SoapTransport, SoapRequestOptions, SoapResponse } from "../../../contracts/transport";

export interface HttpSoapTransportConfig {
  endpoint: string;
  username?: string;
  password?: string;
  timeoutMs?: number;
  soapActionPrefix?: string;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function injectWsSecurity(envelope: string, username: string, password: string): string {
  const header = `<soapenv:Header><wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" soapenv:mustUnderstand="1"><wsse:UsernameToken><wsse:Username>${escapeXml(username)}</wsse:Username><wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${escapeXml(password)}</wsse:Password></wsse:UsernameToken></wsse:Security></soapenv:Header>`;
  if (/<soapenv:Header\s*\/>/i.test(envelope)) return envelope.replace(/<soapenv:Header\s*\/>/i, header);
  if (/<soapenv:Header[\s\S]*?<\/soapenv:Header>/i.test(envelope)) return envelope.replace(/<soapenv:Header[\s\S]*?<\/soapenv:Header>/i, header);
  return envelope.replace(/<soapenv:Body/i, `${header}<soapenv:Body`);
}

/**
 * Transport HTTP SOAP real (browser/edge). Em produção, todas as chamadas
 * SOAP devem partir das edge functions — este transport existe apenas para
 * paridade de contratos e testes locais.
 */
export class HttpSoapTransport implements SoapTransport {
  constructor(private cfg: HttpSoapTransportConfig) {}

  async request(payload: string, opts?: SoapRequestOptions): Promise<SoapResponse> {
    const t0 = performance.now();
    const enriched = this.cfg.username
      ? injectWsSecurity(payload, this.cfg.username, this.cfg.password ?? "")
      : payload;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts?.timeoutMs ?? this.cfg.timeoutMs ?? 60_000);
    try {
      const res = await fetch(opts?.endpoint ?? this.cfg.endpoint, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          "SOAPAction": opts?.soapAction
            ? `"${(this.cfg.soapActionPrefix ?? "")}${opts.soapAction}"`
            : '""',
          "Accept": "text/xml, application/xml",
          ...(opts?.headers ?? {}),
        },
        body: enriched,
      });
      const body = await res.text();
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => (headers[k] = v));
      return { status: res.status, body, headers, durationMs: Math.round(performance.now() - t0) };
    } finally {
      clearTimeout(timer);
    }
  }
}