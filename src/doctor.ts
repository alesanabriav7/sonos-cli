import type { SettingResult } from "./types.js";

export interface DoctorDevice {
  host: string;
  location: string;
  roomName: string;
  modelName: string;
  modelNumber: string;
  serialNumber: string;
  softwareVersion: string;
}

export type RedactedDoctorDevice = Omit<
  DoctorDevice,
  "host" | "location" | "serialNumber"
>;

export interface DoctorReport {
  device: DoctorDevice;
  services: number;
  actions: number;
  tvAudio: { code: string; format: string; raw: Record<string, string> };
  unsupportedSettings: SettingResult[];
}

export interface RedactedDoctorReport {
  device: RedactedDoctorDevice;
  services: number;
  actions: number;
  tvAudio: { code: string; format: string; raw: Record<string, string> };
  unsupportedSettings: SettingResult[];
}

/**
 * Fields inside status/zp's ZPInfo dump (getTvAudioStatus's `raw`) that
 * identify this specific unit or network, mirroring the top-level fields a
 * `doctor --redact` report already strips from `device`. Sonos does not
 * expose a household id through this endpoint today, but the name is kept in
 * this list so a future ZPInfo field with that name is caught automatically
 * rather than requiring someone to remember to add it.
 */
const IDENTIFYING_RAW_KEYS = new Set([
  "SerialNumber",
  "MACAddress",
  "IPAddress",
  "LocalUID",
  "HouseholdID",
]);

/**
 * Strips host, location, and serial number — the fields that identify this
 * specific unit or network — while preserving everything a support report
 * needs: model, firmware (softwareVersion), service/action counts, the audio
 * format, and unsupported-setting evidence. `roomName` is kept: it is a
 * user-chosen label, not a device or network identifier, and support needs
 * it to know which room's soundbar is misbehaving.
 */
export function redactDoctorReport(report: DoctorReport): RedactedDoctorReport {
  const { host, location, serialNumber, ...safeDevice } = report.device;
  return {
    ...report,
    device: safeDevice,
    tvAudio: {
      ...report.tvAudio,
      raw: Object.fromEntries(
        Object.entries(report.tvAudio.raw).filter(
          ([key]) => !IDENTIFYING_RAW_KEYS.has(key),
        ),
      ),
    },
  };
}
