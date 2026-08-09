import type { Device, Service } from "./types.js";
import { asArray, record, text, xmlParser } from "./xml.js";

export interface HttpClient {
  fetch(input: string, init?: RequestInit): Promise<Response>;
}

export const defaultHttpClient: HttpClient = { fetch: globalThis.fetch };

function absolute(base: string, path: string): string {
  return new URL(path, base).toString();
}

function collectServices(node: unknown, base: string, output: Service[]): void {
  const item = record(node);
  const serviceList = record(item.serviceList);
  for (const raw of asArray(serviceList.service)) {
    const service = record(raw);
    const serviceType = text(service.serviceType);
    const controlUrl = text(service.controlURL);
    if (serviceType && controlUrl) {
      output.push({
        serviceType,
        serviceId: text(service.serviceId),
        controlUrl: absolute(base, controlUrl),
        eventSubUrl: absolute(base, text(service.eventSubURL)),
        scpdUrl: absolute(base, text(service.SCPDURL)),
      });
    }
  }
  const deviceList = record(item.deviceList);
  for (const child of asArray(deviceList.device))
    collectServices(child, base, output);
}

export async function inspectDevice(
  host: string,
  client: HttpClient = defaultHttpClient,
): Promise<Device> {
  const location = host.startsWith("http")
    ? host
    : `http://${host}:1400/xml/device_description.xml`;
  const response = await client.fetch(location, {
    signal: AbortSignal.timeout(4_000),
  });
  if (!response.ok)
    throw new Error(`Device description failed: HTTP ${response.status}`);
  const root = record(xmlParser.parse(await response.text())).root;
  const parsedRoot = record(root);
  const rootDevice = record(parsedRoot.device);
  const services: Service[] = [];
  collectServices(rootDevice, location, services);
  const unique = new Map(
    services.map((service) => [
      `${service.serviceType}|${service.controlUrl}`,
      service,
    ]),
  );
  return {
    host: new URL(location).hostname,
    location,
    roomName: text(rootDevice.roomName),
    modelName: text(rootDevice.modelName),
    modelNumber: text(rootDevice.modelNumber),
    serialNumber: text(rootDevice.serialNum),
    softwareVersion: text(rootDevice.softwareVersion),
    services: [...unique.values()].sort((a, b) =>
      a.serviceType.localeCompare(b.serviceType),
    ),
  };
}

export function serviceShortName(serviceType: string): string {
  const parts = serviceType.split(":");
  return parts.at(-2) ?? serviceType;
}

export function findService(device: Device, shortName: string): Service {
  const normalized = shortName.toLowerCase();
  const matches = device.services.filter(
    (service) =>
      serviceShortName(service.serviceType).toLowerCase() === normalized ||
      service.serviceType.toLowerCase() === normalized ||
      service.serviceId.toLowerCase().endsWith(`:${normalized}`),
  );
  if (matches.length === 0)
    throw new Error(`Service not supported: ${shortName}`);
  if (matches.length > 1) throw new Error(`Service is ambiguous: ${shortName}`);
  const match = matches[0];
  if (!match) throw new Error(`Service not supported: ${shortName}`);
  return match;
}
