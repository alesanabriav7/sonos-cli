import type { HttpClient } from "./device.js";
import { defaultHttpClient, serviceShortName } from "./device.js";
import { OutcomeUnknownError } from "./errors.js";
import {
  type ActionRisk,
  assertActionAuthorized,
  classifyAction,
} from "./risk.js";
import { validateInputs } from "./scpd.js";
import { callSoap, SoapFault } from "./soap.js";
import type { Service, ServiceSchema } from "./types.js";

export interface RawActionOptions {
  dryRun?: boolean;
  allowWrite?: boolean;
  allowDestructive?: boolean;
  confirm?: string;
  client?: HttpClient;
}

export interface RawActionResult {
  operation: "raw_action";
  outcome: "dry_run" | "read_completed" | "write_accepted";
  service: string;
  action: string;
  risk: ActionRisk;
  inputs: Record<string, string>;
  output: Record<string, string> | null;
  dryRun: boolean;
  sideEffect: "none" | "accepted";
}

export async function executeRawAction(
  service: Service,
  schema: ServiceSchema,
  action: string,
  inputValues: Record<string, string>,
  options: RawActionOptions = {},
): Promise<RawActionResult> {
  const risk = classifyAction(action);
  const inputs = validateInputs(schema, action, inputValues);
  const dryRun = options.dryRun ?? false;
  if (dryRun) {
    return {
      operation: "raw_action",
      outcome: "dry_run",
      service: serviceShortName(service.serviceType),
      action,
      risk,
      inputs,
      output: null,
      dryRun: true,
      sideEffect: "none",
    };
  }
  assertActionAuthorized(action, risk, options);
  let output: Record<string, string>;
  try {
    output = await callSoap(
      service,
      action,
      inputs,
      options.client ?? defaultHttpClient,
    );
  } catch (error) {
    if (risk === "read" || error instanceof SoapFault) throw error;
    throw new OutcomeUnknownError(
      `Raw write outcome unknown for ${serviceShortName(service.serviceType)}.${action}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return {
    operation: "raw_action",
    outcome: risk === "read" ? "read_completed" : "write_accepted",
    service: serviceShortName(service.serviceType),
    action,
    risk,
    inputs,
    output,
    dryRun: false,
    sideEffect: risk === "read" ? "none" : "accepted",
  };
}
