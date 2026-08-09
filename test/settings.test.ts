import { describe, expect, it } from "vitest";
import type { HttpClient } from "../src/device.js";
import {
  encode,
  listSettingCapabilities,
  SETTINGS,
  setSetting,
} from "../src/settings.js";
import type { Device } from "../src/types.js";

const device: Device = {
  host: "127.0.0.1",
  location: "http://127.0.0.1/device.xml",
  roomName: "Test Room",
  modelName: "Test Soundbar",
  modelNumber: "TEST",
  serialNumber: "TEST",
  softwareVersion: "TEST",
  services: [
    {
      serviceType: "urn:schemas-upnp-org:service:RenderingControl:1",
      serviceId: "urn:upnp-org:serviceId:RenderingControl",
      controlUrl: "http://127.0.0.1/render",
      eventSubUrl: "http://127.0.0.1/event",
      scpdUrl: "http://127.0.0.1/scpd.xml",
    },
  ],
};

function soapResponse(
  action: string,
  fields: Record<string, string>,
): Response {
  const values = Object.entries(fields)
    .map(([name, value]) => `<${name}>${value}</${name}>`)
    .join("");
  return new Response(
    `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:${action}Response xmlns:u="urn:test">${values}</u:${action}Response></s:Body></s:Envelope>`,
    { status: 200 },
  );
}

describe("setting input validation", () => {
  it("normalizes boolean and surround values", () => {
    expect(encode("on", SETTINGS.loudness)).toBe("1");
    expect(encode("false", SETTINGS.status_light)).toBe("Off");
    expect(encode("full", SETTINGS.surround_music_full)).toBe("1");
  });

  it("enforces numeric boundaries before any transport call", () => {
    expect(() => encode("11", SETTINGS.bass)).toThrow(/<= 10/);
    expect(() => encode("loud", SETTINGS.bass)).toThrow(/integer/);
  });

  it("does not write when the live value already matches", async () => {
    const methods: string[] = [];
    const client: HttpClient = {
      fetch: async (_input, init) => {
        methods.push(init?.method ?? "GET");
        return soapResponse("GetBass", { CurrentBass: "4" });
      },
    };
    const result = await setSetting(device, "bass", "4", {
      confirm: "bass",
      client,
    });
    expect(result.changed).toBe(false);
    expect(result.outcome).toBe("unchanged");
    expect(result.sideEffect).toBe("none");
    expect(methods).toEqual(["POST"]);
  });

  it("dry-runs a change with one read and no setter call", async () => {
    const actions: string[] = [];
    const client: HttpClient = {
      fetch: async (_input, init) => {
        const soapAction = new Headers(init?.headers).get("SOAPAction") ?? "";
        actions.push(soapAction.split("#").at(-1)?.replace('"', "") ?? "");
        return soapResponse("GetBass", { CurrentBass: "3" });
      },
    };
    const result = await setSetting(device, "bass", "4", {
      dryRun: true,
      client,
    });
    expect(result).toMatchObject({
      outcome: "dry_run",
      before: 3,
      requested: 4,
      after: null,
      changed: true,
      dryRun: true,
      sideEffect: "none",
    });
    expect(actions).toEqual(["GetBass"]);
  });

  it("performs read, write, read-back for a simulated change", async () => {
    const actions: string[] = [];
    const responses = [
      soapResponse("GetBass", { CurrentBass: "3" }),
      soapResponse("SetBass", {}),
      soapResponse("GetBass", { CurrentBass: "4" }),
    ];
    const client: HttpClient = {
      fetch: async (_input, init) => {
        const soapAction = new Headers(init?.headers).get("SOAPAction") ?? "";
        actions.push(soapAction.split("#").at(-1)?.replace('"', "") ?? "");
        const response = responses.shift();
        if (!response) throw new Error("Unexpected transport call");
        return response;
      },
    };
    const result = await setSetting(device, "bass", "4", {
      confirm: "bass",
      client,
    });
    expect(result).toMatchObject({
      before: 3,
      requested: 4,
      after: 4,
      changed: true,
    });
    expect(actions).toEqual(["GetBass", "SetBass", "GetBass"]);
  });

  it("marks a read-back mismatch as outcome unknown", async () => {
    const responses = [
      soapResponse("GetBass", { CurrentBass: "3" }),
      soapResponse("SetBass", {}),
      soapResponse("GetBass", { CurrentBass: "3" }),
    ];
    const client: HttpClient = {
      fetch: async () => {
        const response = responses.shift();
        if (!response) throw new Error("Unexpected transport call");
        return response;
      },
    };
    await expect(
      setSetting(device, "bass", "4", { confirm: "bass", client }),
    ).rejects.toMatchObject({ name: "OutcomeUnknownError" });
  });

  it("publishes a complete machine-readable capability contract", () => {
    const capabilities = listSettingCapabilities();
    expect(capabilities).toHaveLength(Object.keys(SETTINGS).length);
    expect(capabilities.find((item) => item.name === "bass")).toMatchObject({
      type: "integer",
      minimum: -10,
      maximum: 10,
      writable: true,
      confirmation: "setting_name",
    });
    expect(
      capabilities.find((item) => item.name === "output_fixed"),
    ).toMatchObject({ writable: false, setAction: null });
  });
});
