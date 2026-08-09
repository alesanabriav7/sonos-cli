import { describe, expect, it } from "vitest";
import { validateInputs } from "../src/scpd.js";
import type { ServiceSchema } from "../src/types.js";

const schema: ServiceSchema = {
  actions: [
    {
      name: "SetVolume",
      arguments: [
        {
          name: "InstanceID",
          direction: "in",
          relatedStateVariable: "A_ARG_TYPE_InstanceID",
        },
        {
          name: "Channel",
          direction: "in",
          relatedStateVariable: "A_ARG_TYPE_Channel",
        },
        {
          name: "DesiredVolume",
          direction: "in",
          relatedStateVariable: "Volume",
        },
      ],
    },
  ],
  stateVariables: [
    { name: "A_ARG_TYPE_InstanceID", dataType: "ui4", allowedValues: [] },
    {
      name: "A_ARG_TYPE_Channel",
      dataType: "string",
      allowedValues: ["Master", "LF", "RF"],
    },
    {
      name: "Volume",
      dataType: "ui2",
      allowedValues: [],
      minimum: 0,
      maximum: 100,
      step: 1,
    },
  ],
};

describe("SCPD input validation", () => {
  it("returns inputs in declared order", () => {
    expect(
      validateInputs(schema, "SetVolume", {
        DesiredVolume: "42",
        Channel: "Master",
        InstanceID: "0",
      }),
    ).toEqual({ InstanceID: "0", Channel: "Master", DesiredVolume: "42" });
  });

  it("rejects unknown, missing, enum, and range violations", () => {
    expect(() =>
      validateInputs(schema, "SetVolume", {
        InstanceID: "0",
        Channel: "Master",
        DesiredVolume: "42",
        Extra: "x",
      }),
    ).toThrow(/Unexpected/);
    expect(() =>
      validateInputs(schema, "SetVolume", {
        InstanceID: "0",
        Channel: "Master",
      }),
    ).toThrow(/Missing/);
    expect(() =>
      validateInputs(schema, "SetVolume", {
        InstanceID: "0",
        Channel: "Center",
        DesiredVolume: "42",
      }),
    ).toThrow(/one of/);
    expect(() =>
      validateInputs(schema, "SetVolume", {
        InstanceID: "0",
        Channel: "Master",
        DesiredVolume: "101",
      }),
    ).toThrow(/<= 100/);
  });
});
