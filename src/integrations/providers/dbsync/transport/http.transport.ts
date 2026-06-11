import type {
  SoapRequestOptions,
  SoapResponse,
  SoapTransport,
} from "../../../contracts/transport";

export interface HttpDBSyncTransportConfig {
  endpoint: string;
  endpointFallback?: string;
  timeoutMs?: number;
  /** Prefixo SOAPAction (cada operação é concatenada). Vazio = "". */
  soapActionPrefix?: string;
}

/**
 * Transport HTTP/SOAP real do DBSync.
 *
 * Rede: `fetch` puro com `AbortController` + timeout.
 * Auth: NÃO injeta WS-Security — DBSync usa `Usuario`/`Chave` inline no body
 * (já adicionados pelos `envelope*` da camada XML).
 * Fallback: se a chamada principal falhar com erro de rede E houver
 * `endpointFallback`, repete uma vez no endpoint alternativo.
 */
export class HttpDBSyncTransport implements SoapTransport {
  constructor(private cfg: HttpDBSyncTransportConfig) {}

  async request(payload: string, opts?: SoapRequestOptions): Promise<SoapResponse> {
    const url = opts?.endpoint ?? this.cfg.endpoint;
    try {
      return await this.doRequest(url, payload, opts);
    } catch (err) {
      if (this.cfg.endpointFallback && this.cfg.endpointFallback !== url) {
        return await this.doRequest(this.cfg.endpointFallback, payload, opts);
      }
      throw err;
    }
  }

  private async doRequest(
    url: string,
    payload: string,
    opts?: SoapRequestOptions,
  ): Promise<SoapResponse> {
    const t0 =
      typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(
      () => ctrl.abort(),
      opts?.timeoutMs ?? this.cfg.timeoutMs ?? 30_000,
    );
    try {
      const op = payload.match(/<dbs:([A-Za-z]+)\b/)?.[1] ?? "";
      const soapAction =
        opts?.soapAction ??
        (op ? `${this.cfg.soapActionPrefix ?? ""}${op}` : "");
      const res = await fetch(url, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: soapAction ? `"${soapAction}"` : '""',
          Accept: "text/xml, application/xml",
          ...(opts?.headers ?? {}),
        },
        body: payload,
      });
      const body = await res.text();
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => (headers[k] = v));
      const t1 =
        typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
      return { status: res.status, body, headers, durationMs: Math.round(t1 - t0) };
    } finally {
      clearTimeout(timer);
    }
  }
}