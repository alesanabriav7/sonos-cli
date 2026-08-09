import { describe, expect, it } from "vitest";
import type { HttpClient } from "../src/device.js";
import { executeRawAction } from "../src/raw.js";
import type { Service, ServiceSchema } from "../src/types.js";

const service: Service = {
  serviceType: "urn:schemas-upnp-org:service:RenderingControl:1",
  serviceId: "urn:upnp-org:serviceId:RenderingControl",
  controlUrl: "http://127.0.0.1/render",
  eventSubUrl: "http://127.0.0.1/event",
  scpdUrl: "http://127.0.0.1/scpd.xml",
};

const schema: ServiceSchema = {
  actions: [
    {
      name: "SetBass",
      arguments: [
        {
          name: "InstanceID",
          direction: "in",
          relatedStateVariable: "InstanceID",
        },
        {
          name: "DesiredBass",
          direction: "in",
          relatedStateVariable: "Bass",
        },
      ],
    },
  ],
  stateVariables: [
    { name: "InstanceID", dataType: "ui4", allowedValues: [] },
    {
      name: "Bass",
      dataType: "i2",
      allowedValues: [],
      minimum: -10,
      maximum: 10,
    },
  ],
};

describe("raw action execution", () => {
  it("validates dry-run inputs without calling SOAP", async () => {
    let calls = 0;
    const client: HttpClient = {
      fetch: async () => {
        calls += 1;
        throw new Error("SOAP must not be called in dry-run");
      },
    };
    const result = await executeRawAction(
      service,
      schema,
      "SetBass",
      { InstanceID: "0", DesiredBass: "4" },
      { dryRun: true, client },
    );
    expect(result).toMatchObject({
      outcome: "dry_run",
      risk: "write",
      output: null,
      sideEffect: "none",
    });
    expect(calls).toBe(0);
  });

  it("still validates range boundaries during dry-run", async () => {
    await expect(
      executeRawAction(
        service,
        schema,
        "SetBass",
        { InstanceID: "0", DesiredBass: "11" },
        { dryRun: true },
      ),
    ).rejects.toThrow(/<= 10/);
  });

  it("marks a raw write transport failure as outcome unknown", async () => {
    const client: HttpClient = {
      fetch: async () => {
        throw new Error("timeout");
      },
    };
    await expect(
      executeRawAction(
        service,
        schema,
        "SetBass",
        { InstanceID: "0", DesiredBass: "4" },
        { allowWrite: true, confirm: "SetBass", client },
      ),
    ).rejects.toMatchObject({ name: "OutcomeUnknownError" });
  });

  it("labels a successful raw write as accepted rather than verified", async () => {
    const client: HttpClient = {
      fetch: async () =>
        new Response(
          '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:SetBassResponse xmlns:u="urn:test" /></s:Body></s:Envelope>',
          { status: 200 },
        ),
    };
    const result = await executeRawAction(
      service,
      schema,
      "SetBass",
      { InstanceID: "0", DesiredBass: "4" },
      { allowWrite: true, confirm: "SetBass", client },
    );
    expect(result).toMatchObject({
      outcome: "write_accepted",
      sideEffect: "accepted",
    });
  });
});
