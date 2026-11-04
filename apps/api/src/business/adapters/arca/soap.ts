import { innerXml, textOf } from './xml';

/** Transport failure (network, timeout, HTTP error, SOAP fault): callers keep the receipt retriable. */
export class ArcaUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArcaUnavailableError';
  }
}

export class ArcaSoapFaultError extends ArcaUnavailableError {
  constructor(
    service: string,
    readonly faultCode: string,
    readonly faultString: string,
  ) {
    super(`ARCA (${service}) devolvió un error SOAP: ${faultCode} - ${faultString}`);
    this.name = 'ArcaSoapFaultError';
  }
}

export interface SoapCall {
  /** Name used in error messages, e.g. "WSAA". */
  service: string;
  url: string;
  soapAction: string;
  envelope: string;
  timeoutMs: number;
}

/**
 * POSTs a SOAP 1.1 envelope and returns the response body. Faults are checked before the status
 * because ARCA sends them with HTTP 500. Error messages never include the request body, which
 * carries the CMS or the token and sign.
 */
export async function postSoap(call: SoapCall): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), call.timeoutMs);
  let status: number;
  let body: string;
  try {
    const response = await fetch(call.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `"${call.soapAction}"` },
      body: call.envelope,
      signal: controller.signal,
    });
    status = response.status;
    body = await response.text();
  } catch (error) {
    if (controller.signal.aborted) throw new ArcaUnavailableError(`ARCA (${call.service}) no respondió en ${call.timeoutMs} ms`);
    throw new ArcaUnavailableError(`ARCA (${call.service}) no respondió: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    clearTimeout(timer);
  }

  const fault = innerXml(body, 'Fault');
  if (fault !== undefined) {
    throw new ArcaSoapFaultError(call.service, textOf(fault, 'faultcode') ?? 'desconocido', textOf(fault, 'faultstring') ?? '');
  }
  if (status !== 200) throw new ArcaUnavailableError(`ARCA (${call.service}) respondió HTTP ${status}`);
  return body;
}
