#!/usr/bin/env node
import { Command, Option } from "commander";
import { findService, inspectDevice, serviceShortName } from "./device.js";
import { discoverLocations } from "./discovery.js";
import { assertActionAuthorized, classifyAction } from "./risk.js";
import { inspectService, validateInputs } from "./scpd.js";
import {
  getAllSettings,
  getSetting,
  SETTINGS,
  type SettingName,
  setSetting,
} from "./settings.js";
import { callSoap } from "./soap.js";
import { getTvAudioStatus } from "./status.js";
import type { Device } from "./types.js";

interface GlobalOptions {
  host?: string;
  timeout: string;
}

function print(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function resolveDevice(options: GlobalOptions): Promise<Device> {
  if (options.host) return await inspectDevice(options.host);
  const locations = await discoverLocations(Number(options.timeout));
  const devices = await Promise.all(
    locations.map((location) => inspectDevice(location)),
  );
  const soundbars = devices.filter((device) =>
    /Arc|Beam|Ray|Playbar|Playbase/i.test(
      `${device.modelName} ${device.modelNumber}`,
    ),
  );
  if (soundbars.length === 1) return soundbars[0] as Device;
  if (devices.length === 1) return devices[0] as Device;
  throw new Error(
    soundbars.length === 0
      ? `Could not select a home-theater coordinator from ${devices.length} devices; use --host`
      : `Found ${soundbars.length} soundbars; use --host`,
  );
}

function parseArguments(values: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const value of values) {
    const separator = value.indexOf("=");
    if (separator < 1) throw new Error(`Argument must be key=value: ${value}`);
    result[value.slice(0, separator)] = value.slice(separator + 1);
  }
  return result;
}

const program = new Command()
  .name("sonosctl")
  .description("Deterministic, local-first Sonos configuration CLI")
  .version("0.1.0")
  .option("--host <host>", "Sonos IP or device-description URL")
  .option("--timeout <ms>", "SSDP discovery timeout", "1500")
  .showHelpAfterError();

program
  .command("discover")
  .description("Discover and inspect all Sonos players")
  .action(async () => {
    const options = program.opts<GlobalOptions>();
    const locations = await discoverLocations(Number(options.timeout));
    const devices = await Promise.all(
      locations.map((location) => inspectDevice(location)),
    );
    print(
      devices.map(({ services, ...device }) => ({
        ...device,
        serviceCount: services.length,
      })),
    );
  });

program
  .command("settings")
  .description("Read every known high-level setting")
  .action(async () => {
    const device = await resolveDevice(program.opts<GlobalOptions>());
    print({
      device: {
        host: device.host,
        roomName: device.roomName,
        modelName: device.modelName,
      },
      settings: await getAllSettings(device),
    });
  });

program
  .command("get")
  .argument("<setting>", `Setting: ${Object.keys(SETTINGS).sort().join(", ")}`)
  .description("Read one high-level setting")
  .action(async (setting: string) => {
    if (!(setting in SETTINGS)) throw new Error(`Unknown setting: ${setting}`);
    print(
      await getSetting(
        await resolveDevice(program.opts<GlobalOptions>()),
        setting as SettingName,
      ),
    );
  });

program
  .command("set")
  .argument("<setting>")
  .argument("<value>")
  .requiredOption("--confirm <setting>", "Confirm the exact setting name")
  .description("Write one allowlisted setting and verify it by reading back")
  .action(
    async (setting: string, value: string, options: { confirm: string }) => {
      if (!(setting in SETTINGS))
        throw new Error(`Unknown setting: ${setting}`);
      print(
        await setSetting(
          await resolveDevice(program.opts<GlobalOptions>()),
          setting as SettingName,
          value,
          options.confirm,
        ),
      );
    },
  );

program
  .command("status")
  .description("Read device identity, TV audio input format, and settings")
  .action(async () => {
    const device = await resolveDevice(program.opts<GlobalOptions>());
    const [audio, settings] = await Promise.all([
      getTvAudioStatus(device.host),
      getAllSettings(device),
    ]);
    print({
      device: {
        host: device.host,
        roomName: device.roomName,
        modelName: device.modelName,
        modelNumber: device.modelNumber,
        softwareVersion: device.softwareVersion,
      },
      audio,
      settings,
    });
  });

program
  .command("snapshot")
  .description("Emit a restorable high-level settings snapshot")
  .action(async () => {
    const device = await resolveDevice(program.opts<GlobalOptions>());
    const settings = await getAllSettings(device);
    print({
      schemaVersion: 1,
      capturedAt: new Date().toISOString(),
      device: {
        roomName: device.roomName,
        modelName: device.modelName,
        serialNumber: device.serialNumber,
      },
      settings: Object.fromEntries(
        settings
          .filter((item) => item.supported)
          .map((item) => [item.setting, item.value]),
      ),
    });
  });

program
  .command("doctor")
  .description(
    "Check discovery, device description, service schemas, and TV audio status",
  )
  .action(async () => {
    const device = await resolveDevice(program.opts<GlobalOptions>());
    const schemas = await Promise.all(
      device.services.map(async (service) => ({
        service: serviceShortName(service.serviceType),
        schema: await inspectService(service),
      })),
    );
    print({
      ok: true,
      device: {
        host: device.host,
        roomName: device.roomName,
        modelName: device.modelName,
      },
      services: schemas.length,
      actions: schemas.reduce(
        (sum, item) => sum + item.schema.actions.length,
        0,
      ),
      tvAudio: await getTvAudioStatus(device.host),
    });
  });

const api = program
  .command("api")
  .description("Inspect or invoke the live device-declared SOAP API");

api
  .command("list")
  .description("List services and actions with risk classification")
  .action(async () => {
    const device = await resolveDevice(program.opts<GlobalOptions>());
    const services = await Promise.all(
      device.services.map(async (service) => ({
        service: serviceShortName(service.serviceType),
        serviceType: service.serviceType,
        actions: (await inspectService(service)).actions.map((action) => ({
          name: action.name,
          risk: classifyAction(action.name),
        })),
      })),
    );
    print({
      device: { host: device.host, roomName: device.roomName },
      serviceCount: services.length,
      actionCount: services.reduce(
        (sum, service) => sum + service.actions.length,
        0,
      ),
      services,
    });
  });

api
  .command("describe")
  .argument("<service>")
  .argument("[action]")
  .description("Describe one live service or action schema")
  .action(async (serviceName: string, actionName?: string) => {
    const service = findService(
      await resolveDevice(program.opts<GlobalOptions>()),
      serviceName,
    );
    const schema = await inspectService(service);
    if (!actionName)
      return print({
        service: serviceShortName(service.serviceType),
        ...schema,
      });
    const action = schema.actions.find(
      (candidate) => candidate.name === actionName,
    );
    if (!action) throw new Error(`Action not supported: ${actionName}`);
    const related = new Set(
      action.arguments.map((argument) => argument.relatedStateVariable),
    );
    print({
      service: serviceShortName(service.serviceType),
      action: { ...action, risk: classifyAction(action.name) },
      stateVariables: schema.stateVariables.filter((variable) =>
        related.has(variable.name),
      ),
    });
  });

api
  .command("call")
  .argument("<service>")
  .argument("<action>")
  .addOption(
    new Option("--arg <key=value>", "SOAP input argument")
      .default([])
      .argParser((value: string, previous: string[]) => [...previous, value]),
  )
  .option("--allow-write", "Acknowledge a raw write")
  .option("--allow-destructive", "Acknowledge a destructive raw write")
  .option("--confirm <action>", "Confirm the exact action name")
  .description("Invoke a live-declared SOAP action after schema validation")
  .action(
    async (
      serviceName: string,
      actionName: string,
      options: {
        arg: string[];
        allowWrite?: boolean;
        allowDestructive?: boolean;
        confirm?: string;
      },
    ) => {
      const service = findService(
        await resolveDevice(program.opts<GlobalOptions>()),
        serviceName,
      );
      const schema = await inspectService(service);
      const risk = classifyAction(actionName);
      assertActionAuthorized(actionName, risk, options);
      const inputs = validateInputs(
        schema,
        actionName,
        parseArguments(options.arg),
      );
      print({
        service: serviceShortName(service.serviceType),
        action: actionName,
        risk,
        inputs,
        output: await callSoap(service, actionName, inputs),
      });
    },
  );

program.configureOutput({
  writeErr: (value) => process.stderr.write(value),
});

program.parseAsync().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })}\n`,
  );
  process.exitCode = 1;
});
