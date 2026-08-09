export interface SuccessEnvelope<T> {
  ok: true;
  data: T;
}

export interface ErrorDetails {
  code: string;
  message: string;
  hint: string | null;
}

export interface ErrorEnvelope {
  ok: false;
  error: ErrorDetails;
}

export function successEnvelope<T>(data: T): SuccessEnvelope<T> {
  return { ok: true, data };
}

export function errorEnvelope(error: unknown): ErrorEnvelope {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof OutcomeUnknownError) {
    return {
      ok: false,
      error: {
        code: "OUTCOME_UNKNOWN",
        message,
        hint: "Read the affected state before deciding whether a retry is safe.",
      },
    };
  }
  if (message.includes("use --host")) {
    return {
      ok: false,
      error: {
        code: "DEVICE_SELECTION_REQUIRED",
        message,
        hint: "Run discover, then retry with --host <ip>.",
      },
    };
  }
  if (message.includes("Unknown setting")) {
    return {
      ok: false,
      error: {
        code: "UNKNOWN_SETTING",
        message,
        hint: "Run capabilities to list accepted setting names.",
      },
    };
  }
  if (message.includes("Write requires")) {
    return {
      ok: false,
      error: {
        code: "CONFIRMATION_REQUIRED",
        message,
        hint: "Run with --dry-run first, then pass the exact confirmation token.",
      },
    };
  }
  if (message.includes("read-only")) {
    return {
      ok: false,
      error: {
        code: "READ_ONLY",
        message,
        hint: "Inspect capabilities and choose a writable setting.",
      },
    };
  }
  if (
    message.includes("must be") ||
    message.includes("Missing argument") ||
    message.includes("Unexpected argument")
  ) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message,
        hint: "Inspect capabilities or api describe for the accepted input contract.",
      },
    };
  }
  return {
    ok: false,
    error: { code: "COMMAND_FAILED", message, hint: null },
  };
}

import { OutcomeUnknownError } from "./errors.js";
