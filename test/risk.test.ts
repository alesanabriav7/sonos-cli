import { describe, expect, it } from "vitest";
import { assertActionAuthorized, classifyAction } from "../src/risk.js";

describe("action risk", () => {
  it("classifies reads, writes, and destructive actions", () => {
    expect(classifyAction("GetVolume")).toBe("read");
    expect(classifyAction("SetVolume")).toBe("write");
    expect(classifyAction("RemoveHTSatellite")).toBe("destructive");
  });

  it("requires exact write confirmation", () => {
    expect(() => assertActionAuthorized("SetVolume", "write", {})).toThrow(
      /--allow-write/,
    );
    expect(() =>
      assertActionAuthorized("SetVolume", "write", {
        allowWrite: true,
        confirm: "SetMute",
      }),
    ).toThrow(/--allow-write/);
    expect(() =>
      assertActionAuthorized("SetVolume", "write", {
        allowWrite: true,
        confirm: "SetVolume",
      }),
    ).not.toThrow();
  });

  it("requires a second acknowledgement for destructive actions", () => {
    expect(() =>
      assertActionAuthorized("RemoveHTSatellite", "destructive", {
        allowWrite: true,
        confirm: "RemoveHTSatellite",
      }),
    ).toThrow(/--allow-destructive/);
  });
});
