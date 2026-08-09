import { defaultHttpClient, findService, type HttpClient } from "./device.js";
import { OutcomeUnknownError } from "./errors.js";
import { callSoap, SoapFault } from "./soap.js";
import type { Device, Scalar, SettingResult } from "./types.js";

type ValueKind = "boolean" | "integer" | "surroundMode" | "onOff";

export interface SettingDefinition {
  service: string;
  getAction: string;
  getArgs: Record<string, string>;
  result: string;
  setAction?: string;
  setArgs?: Record<string, string>;
  input: string;
  kind: ValueKind;
  minimum?: number;
  maximum?: number;
}

export const SETTINGS = {
  volume: rc("Volume", "Master", "integer", 0, 100),
  mute: rc("Mute", "Master", "boolean"),
  bass: rc("Bass", undefined, "integer", -10, 10),
  treble: rc("Treble", undefined, "integer", -10, 10),
  loudness: rc("Loudness", "Master", "boolean"),
  output_fixed: readOnlyRc("OutputFixed", "CurrentFixed", "boolean"),
  room_calibration: roomCalibration(),
  sub_enabled: eq("SubEnable", "boolean"),
  sub_gain: eq("SubGain", "integer", -15, 15),
  sub_polarity: eq("SubPolarity", "boolean"),
  surrounds_enabled: eq("SurroundEnable", "boolean"),
  surround_tv_level: eq("SurroundLevel", "integer", -15, 15),
  surround_music_level: eq("MusicSurroundLevel", "integer", -15, 15),
  surround_music_full: eq("SurroundMode", "surroundMode"),
  night_mode: eq("NightMode", "boolean"),
  speech_enhancement: eq("SpeechEnhanceEnabled", "boolean"),
  tv_dialog_sync: eq("AudioDelay", "integer", 0, 5),
  height_level: eq("HeightChannelLevel", "integer", -10, 10),
  status_light: deviceProperty("LEDState", "CurrentLEDState", "onOff"),
  button_lock: deviceProperty(
    "ButtonLockState",
    "CurrentButtonLockState",
    "onOff",
  ),
  ir_repeater: ht("IRRepeaterState", "CurrentIRRepeaterState", "onOff"),
  ir_led_feedback: ht("LEDFeedbackState", "LEDFeedbackState", "onOff"),
  group_volume: group("Volume", "integer", 0, 100),
  group_mute: group("Mute", "boolean"),
} satisfies Record<string, SettingDefinition>;

export type SettingName = keyof typeof SETTINGS;

const SETTING_DESCRIPTIONS: Record<SettingName, string> = {
  bass: "Master bass EQ level",
  button_lock: "Physical button lock state",
  group_mute: "Mute state for the coordinator group",
  group_volume: "Volume for the coordinator group",
  height_level: "Dolby Atmos height-channel level",
  ir_led_feedback: "IR command LED feedback state",
  ir_repeater: "IR repeater state",
  loudness: "Loudness compensation state",
  mute: "Master mute state",
  night_mode: "Night sound compression state",
  output_fixed: "Whether the audio output volume is fixed",
  room_calibration: "Room calibration processing state",
  speech_enhancement: "TV dialogue enhancement state",
  status_light: "Player status light state",
  sub_enabled: "Bonded Sub output state",
  sub_gain: "Bonded Sub level",
  sub_polarity: "Bonded Sub polarity state",
  surround_music_full: "Music surround playback mode",
  surround_music_level: "Surround level for music playback",
  surround_tv_level: "Surround level for TV playback",
  surrounds_enabled: "Bonded surround output state",
  treble: "Master treble EQ level",
  tv_dialog_sync: "TV dialogue synchronization delay",
  volume: "Master volume",
};

export interface SettingCapability {
  name: SettingName;
  description: string;
  type: "boolean" | "integer" | "enum";
  acceptedValues: string[];
  minimum: number | null;
  maximum: number | null;
  readable: true;
  writable: boolean;
  confirmation: "setting_name" | "not_applicable";
  service: string;
  getAction: string;
  setAction: string | null;
}

export function listSettingCapabilities(): SettingCapability[] {
  return (Object.keys(SETTINGS).sort() as SettingName[]).map((name) => {
    const definition = SETTINGS[name];
    const type =
      definition.kind === "integer"
        ? "integer"
        : definition.kind === "surroundMode"
          ? "enum"
          : "boolean";
    const acceptedValues =
      definition.kind === "surroundMode"
        ? ["ambient", "full"]
        : definition.kind === "boolean" || definition.kind === "onOff"
          ? ["false", "true"]
          : [];
    const writable = definition.setAction !== undefined;
    return {
      name,
      description: SETTING_DESCRIPTIONS[name],
      type,
      acceptedValues,
      minimum: definition.minimum ?? null,
      maximum: definition.maximum ?? null,
      readable: true,
      writable,
      confirmation: writable ? "setting_name" : "not_applicable",
      service: definition.service,
      getAction: definition.getAction,
      setAction: definition.setAction ?? null,
    };
  });
}

function rc(
  name: string,
  channel: string | undefined,
  kind: ValueKind,
  minimum?: number,
  maximum?: number,
): SettingDefinition {
  const channelArgs = channel ? { Channel: channel } : {};
  return {
    service: "RenderingControl",
    getAction: `Get${name}`,
    getArgs: { InstanceID: "0", ...channelArgs },
    result: `Current${name}`,
    setAction: `Set${name}`,
    setArgs: { InstanceID: "0", ...channelArgs },
    input: `Desired${name}`,
    kind,
    ...(minimum === undefined ? {} : { minimum }),
    ...(maximum === undefined ? {} : { maximum }),
  };
}

function readOnlyRc(
  name: string,
  result: string,
  kind: ValueKind,
): SettingDefinition {
  return {
    service: "RenderingControl",
    getAction: `Get${name}`,
    getArgs: { InstanceID: "0" },
    result,
    input: "",
    kind,
  };
}

function roomCalibration(): SettingDefinition {
  return {
    service: "RenderingControl",
    getAction: "GetRoomCalibrationStatus",
    getArgs: { InstanceID: "0" },
    result: "RoomCalibrationEnabled",
    setAction: "SetRoomCalibrationStatus",
    setArgs: { InstanceID: "0" },
    input: "RoomCalibrationEnabled",
    kind: "boolean",
  };
}

function eq(
  eqType: string,
  kind: ValueKind,
  minimum?: number,
  maximum?: number,
): SettingDefinition {
  return {
    service: "RenderingControl",
    getAction: "GetEQ",
    getArgs: { InstanceID: "0", EQType: eqType },
    result: "CurrentValue",
    setAction: "SetEQ",
    setArgs: { InstanceID: "0", EQType: eqType },
    input: "DesiredValue",
    kind,
    ...(minimum === undefined ? {} : { minimum }),
    ...(maximum === undefined ? {} : { maximum }),
  };
}

function deviceProperty(
  name: string,
  result: string,
  kind: ValueKind,
): SettingDefinition {
  return {
    service: "DeviceProperties",
    getAction: `Get${name}`,
    getArgs: {},
    result,
    setAction: `Set${name}`,
    setArgs: {},
    input: "DesiredState",
    kind,
  };
}

function ht(name: string, result: string, kind: ValueKind): SettingDefinition {
  return {
    service: "HTControl",
    getAction: `Get${name}`,
    getArgs: {},
    result,
    setAction: `Set${name}`,
    setArgs: {},
    input: "DesiredState",
    kind,
  };
}

function group(
  name: string,
  kind: ValueKind,
  minimum?: number,
  maximum?: number,
): SettingDefinition {
  return {
    service: "GroupRenderingControl",
    getAction: `GetGroup${name}`,
    getArgs: { InstanceID: "0" },
    result: `Current${name}`,
    setAction: `SetGroup${name}`,
    setArgs: { InstanceID: "0" },
    input: `Desired${name}`,
    kind,
    ...(minimum === undefined ? {} : { minimum }),
    ...(maximum === undefined ? {} : { maximum }),
  };
}

function parseBoolean(raw: string): boolean {
  return raw === "1" || raw.toLowerCase() === "true" || raw === "On";
}

function decode(raw: string, kind: ValueKind): Scalar {
  if (kind === "boolean") return parseBoolean(raw);
  if (kind === "integer") return Number(raw);
  if (kind === "surroundMode") return raw === "1" ? "full" : "ambient";
  return raw === "On" ? true : raw === "Off" ? false : raw;
}

export function encode(value: string, definition: SettingDefinition): string {
  if (definition.kind === "boolean" || definition.kind === "onOff") {
    if (
      !["true", "false", "on", "off", "1", "0"].includes(value.toLowerCase())
    ) {
      throw new Error("Value must be true/false, on/off, or 1/0");
    }
    const enabled = ["true", "on", "1"].includes(value.toLowerCase());
    return definition.kind === "onOff"
      ? enabled
        ? "On"
        : "Off"
      : enabled
        ? "1"
        : "0";
  }
  if (definition.kind === "surroundMode") {
    if (!new Set(["full", "ambient", "1", "0"]).has(value.toLowerCase())) {
      throw new Error("Value must be full or ambient");
    }
    return ["full", "1"].includes(value.toLowerCase()) ? "1" : "0";
  }
  const number = Number(value);
  if (!Number.isInteger(number)) throw new Error("Value must be an integer");
  if (definition.minimum !== undefined && number < definition.minimum) {
    throw new Error(`Value must be >= ${definition.minimum}`);
  }
  if (definition.maximum !== undefined && number > definition.maximum) {
    throw new Error(`Value must be <= ${definition.maximum}`);
  }
  return String(number);
}

export async function getSetting(
  device: Device,
  name: SettingName,
  client: HttpClient = defaultHttpClient,
): Promise<SettingResult> {
  const definition = SETTINGS[name];
  const service = findService(device, definition.service);
  const response = await callSoap(
    service,
    definition.getAction,
    definition.getArgs,
    client,
  );
  const raw = response[definition.result];
  if (raw === undefined)
    throw new Error(`Missing ${definition.result} in ${definition.getAction}`);
  return {
    setting: name,
    value: decode(raw, definition.kind),
    supported: true,
    source: `${definition.service}.${definition.getAction}`,
  };
}

export async function setSetting(
  device: Device,
  name: SettingName,
  value: string,
  options: {
    confirm?: string;
    dryRun?: boolean;
    client?: HttpClient;
  } = {},
): Promise<SetSettingResult> {
  const client = options.client ?? defaultHttpClient;
  const dryRun = options.dryRun ?? false;
  const definition = SETTINGS[name];
  if (!definition.setAction || !definition.setArgs)
    throw new Error(`Setting is read-only: ${name}`);
  if (!dryRun && options.confirm !== name)
    throw new Error(`Write requires --confirm ${name}`);
  const encoded = encode(value, definition);
  const before = await getSetting(device, name, client);
  const requested = decode(encoded, definition.kind);
  const wouldCall = `${definition.service}.${definition.setAction}`;
  if (dryRun) {
    return {
      operation: "set_setting",
      outcome: "dry_run",
      setting: name,
      before: before.value,
      requested,
      after: null,
      changed: before.value !== requested,
      dryRun: true,
      sideEffect: "none",
      wouldCall,
    };
  }
  if (before.value === requested) {
    return {
      operation: "set_setting",
      outcome: "unchanged",
      setting: name,
      before: before.value,
      requested,
      after: before.value,
      changed: false,
      dryRun: false,
      sideEffect: "none",
      wouldCall,
    };
  }
  const service = findService(device, definition.service);
  let writeAccepted = false;
  try {
    await callSoap(
      service,
      definition.setAction,
      {
        ...definition.setArgs,
        [definition.input]: encoded,
      },
      client,
    );
    writeAccepted = true;
    const after = await getSetting(device, name, client);
    if (after.value !== requested) {
      throw new OutcomeUnknownError(
        `Read-back mismatch for ${name}: requested ${String(requested)}, got ${String(after.value)}`,
      );
    }
    return {
      operation: "set_setting",
      outcome: "changed",
      setting: name,
      before: before.value,
      requested,
      after: after.value,
      changed: true,
      dryRun: false,
      sideEffect: "completed",
      wouldCall,
    };
  } catch (error) {
    if (error instanceof OutcomeUnknownError) throw error;
    if (writeAccepted) {
      throw new OutcomeUnknownError(
        `Read-back failed for ${name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (error instanceof SoapFault) throw error;
    throw new OutcomeUnknownError(
      `Write outcome unknown for ${name}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export interface SetSettingResult {
  operation: "set_setting";
  outcome: "dry_run" | "unchanged" | "changed";
  setting: string;
  before: Scalar;
  requested: Scalar;
  after: Scalar | null;
  changed: boolean;
  dryRun: boolean;
  sideEffect: "none" | "completed";
  wouldCall: string;
}

export async function getAllSettings(device: Device): Promise<SettingResult[]> {
  const results: SettingResult[] = [];
  for (const name of Object.keys(SETTINGS).sort() as SettingName[]) {
    try {
      results.push(await getSetting(device, name));
    } catch (error) {
      results.push({
        setting: name,
        value: "unsupported",
        supported: false,
        source: SETTINGS[name].service,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
