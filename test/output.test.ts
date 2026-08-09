import { describe, expect, it } from "vitest";
import { OutcomeUnknownError } from "../src/errors.js";
import { errorEnvelope, successEnvelope } from "../src/output.js";

describe("machine output envelopes", () => {
  it("wraps successful data with an unambiguous discriminator", () => {
    expect(successEnvelope({ outcome: "dry_run" })).toEqual({
      ok: true,
      data: { outcome: "dry_run" },
    });
  });

  it.each([
    ["Unknown setting: boost", "UNKNOWN_SETTING"],
    ["Write requires --confirm bass", "CONFIRMATION_REQUIRED"],
    ["Setting is read-only: output_fixed", "READ_ONLY"],
    ["Value must be <= 10", "VALIDATION_ERROR"],
    ["transport disappeared", "COMMAND_FAILED"],
  ])("maps %s to %s", (message, code) => {
    const result = errorEnvelope(new Error(message));
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe(code);
  });

  it("distinguishes an uncertain write from an ordinary failure", () => {
    const result = errorEnvelope(
      new OutcomeUnknownError("Write outcome unknown for bass: timeout"),
    );
    expect(result.error).toMatchObject({
      code: "OUTCOME_UNKNOWN",
      hint: expect.stringContaining("Read the affected state"),
    });
  });
});
