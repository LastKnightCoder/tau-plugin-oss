interface RequestOptions {
  method?: string;
  headers?: Record<string, string>;
  content?: Uint8Array | string;
  timeout?: number;
}

/** SDK负责协议与签名，传输只通过宿主fetch。 */
export function createTransport(fetch: typeof globalThis.fetch) {
  return {
    async request(url: string, options: RequestOptions) {
      const content = options.content;
      const response = await fetch(url, {
        method: options.method,
        headers: options.headers,
        body:
          typeof content === "string"
            ? content
            : content
              ? new Uint8Array(content)
              : undefined,
        signal: options.timeout
          ? AbortSignal.timeout(options.timeout)
          : undefined,
      });
      const headers = Object.fromEntries(response.headers);
      return {
        status: response.status,
        headers,
        data: await response.text(),
        res: { status: response.status, statusCode: response.status, headers },
      };
    },
  };
}
