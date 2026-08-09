import type { HttpClient } from "./device.js";
import { defaultHttpClient } from "./device.js";
import type { Service } from "./types.js";
import { escapeXml, record, text, xmlParser } from "./xml.js";

export class SoapFault extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "SoapFault";
  }
}

export async function callSoap(
  service: Service,
  action: string,
  inputs: Record<string, string>,
  client: HttpClient = defaultHttpClient,
): Promise<Record<string, string>> {
  const args = Object.entries(inputs)
    .map(([name, value]) => `<${name}>${escapeXml(value)}</${name}>`)
    .join("");
  const body = `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:${action} xmlns:u="${service.serviceType}">${args}</u:${action}></s:Body></s:Envelope>`;
  const response = await client.fetch(service.controlUrl, {
    method: "POST",
    headers: {
      "Content-Type": 'text/xml; charset="utf-8"',
      SOAPAction: `"${service.serviceType}#${action}"`,
    },
    body,
    signal: AbortSignal.timeout(5_000),
  });
  const raw = await response.text();
  const envelope = record(record(xmlParser.parse(raw)).Envelope);
  const soapBody = record(envelope.Body);
  if (!response.ok || soapBody.Fault) {
    const fault = record(soapBody.Fault);
    const detail = record(fault.detail);
    const upnp = record(detail.UPnPError);
    throw new SoapFault(
      text(
        upnp.errorDescription || fault.faultstring || `HTTP ${response.status}`,
      ),
      response.status,
      text(upnp.errorCode),
    );
  }
  const responseNode = record(soapBody[`${action}Response`]);
  return Object.fromEntries(
    Object.entries(responseNode)
      .filter(([key]) => !key.startsWith("@_"))
      .map(([key, value]) => [key, text(value)]),
  );
}
