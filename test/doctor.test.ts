import { describe, expect, it } from "vitest";
import { type DoctorReport, redactDoctorReport } from "../src/doctor.js";

const report: DoctorReport = {
  device: {
    host: "192.168.1.42",
    location: "http://192.168.1.42:1400/xml/device_description.xml",
    roomName: "Living Room",
    modelName: "Sonos Arc",
    modelNumber: "S23",
    serialNumber: "00-11-22-33-44-55:B",
    softwareVersion: "80.3-12345",
  },
  services: 6,
  actions: 42,
  tvAudio: {
    code: "63",
    format: "Dolby Atmos (TrueHD/MAT)",
    raw: {
      HTAudioInCode: "63",
      SerialNumber: "00-11-22-33-44-55:B",
      MACAddress: "00:11:22:33:44:55",
      IPAddress: "192.168.1.42",
      HardwareVersion: "1.20.1.6-2",
    },
  },
  unsupportedSettings: [
    {
      setting: "sub_gain",
      value: "unsupported",
      supported: false,
      source: "urn:upnp-org:serviceId:RenderingControl",
      error: "Unknown action: GetSubGain",
    },
  ],
};

const SENSITIVE_VALUES = [
  "192.168.1.42",
  "http://192.168.1.42:1400/xml/device_description.xml",
  "00-11-22-33-44-55:B",
  "00:11:22:33:44:55",
];

describe("redactDoctorReport", () => {
  it("removes host, location, and serial number from device", () => {
    const redacted = redactDoctorReport(report);

    expect(redacted.device).not.toHaveProperty("host");
    expect(redacted.device).not.toHaveProperty("location");
    expect(redacted.device).not.toHaveProperty("serialNumber");
  });

  it("removes identifying keys from the raw TV audio status dump", () => {
    const redacted = redactDoctorReport(report);

    expect(redacted.tvAudio.raw).not.toHaveProperty("SerialNumber");
    expect(redacted.tvAudio.raw).not.toHaveProperty("MACAddress");
    expect(redacted.tvAudio.raw).not.toHaveProperty("IPAddress");
  });

  it("never lets a sensitive value survive anywhere in the redacted report, serialized", () => {
    const redacted = redactDoctorReport(report);
    const serialized = JSON.stringify(redacted);

    for (const value of SENSITIVE_VALUES) {
      expect(serialized).not.toContain(value);
    }
  });

  it("preserves model, firmware, counts, audio format, and unsupported-setting evidence", () => {
    const redacted = redactDoctorReport(report);

    expect(redacted.device.roomName).toBe("Living Room");
    expect(redacted.device.modelName).toBe("Sonos Arc");
    expect(redacted.device.modelNumber).toBe("S23");
    expect(redacted.device.softwareVersion).toBe("80.3-12345");
    expect(redacted.services).toBe(6);
    expect(redacted.actions).toBe(42);
    expect(redacted.tvAudio.format).toBe("Dolby Atmos (TrueHD/MAT)");
    expect(redacted.tvAudio.raw.HardwareVersion).toBe("1.20.1.6-2");
    expect(redacted.unsupportedSettings).toEqual(report.unsupportedSettings);
  });
});
