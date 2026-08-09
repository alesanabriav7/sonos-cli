# sonos-cli

`sonosctl` is a deterministic, local-first CLI for inspecting and configuring Sonos players over their device-declared UPnP/SOAP API. It discovers capabilities from the current firmware instead of relying on a frozen action list.

## Safety model

- Reads are allowed without confirmation.
- High-level writes validate the value, read the current value, require `--confirm <setting>`, write once, and verify by reading back.
- Raw writes require `--allow-write --confirm <ExactAction>`.
- Raw destructive actions also require `--allow-destructive`.
- Tests use fixtures and never contact the LAN.

The local SOAP interface is device-declared but not a stable public Sonos API. Firmware can add, remove, or change actions. `api describe` exposes the live schema and validation boundaries.

## Install and build

Requirements: Node.js 22+, pnpm 10+, and Bun for the standalone executable.

```bash
pnpm install
pnpm check
pnpm package
./dist/sonosctl --help
```

For development:

```bash
pnpm dev -- --help
```

## Device selection

By default, discovery selects the only soundbar on the LAN. Use `--host` when there are multiple home theaters or multicast discovery is unavailable:

```bash
sonosctl --host 192.168.1.50 status
```

## Stable high-level interface

```bash
sonosctl settings
sonosctl get bass
sonosctl set bass 4 --confirm bass
sonosctl set night_mode off --confirm night_mode
sonosctl snapshot > living-room.json
sonosctl doctor
```

Supported names are printed by `sonosctl get --help`. They cover volume/mute, tone and loudness, Sub and surround controls, night/speech/dialog/height controls, status light/button lock, IR feedback, group volume, and calibration where the current device supports them.

`snapshot` is read-only in v0.1. It deliberately does not include a bulk restore command: every write remains explicit and independently verified.

## Live API inventory and raw calls

```bash
sonosctl api list
sonosctl api describe RenderingControl SetBass
sonosctl api call RenderingControl GetBass --arg InstanceID=0
sonosctl api call RenderingControl SetBass \
  --arg InstanceID=0 --arg DesiredBass=4 \
  --allow-write --confirm SetBass
```

The raw interface validates required arguments, enumerations, and numeric ranges from the live SCPD document before invoking SOAP. Destructive actions are available only as an expert escape hatch:

```bash
sonosctl api call DeviceProperties RemoveHTSatellite ... \
  --allow-write --allow-destructive --confirm RemoveHTSatellite
```

Do not use the destructive interface without a current snapshot and a specific rollback plan.

See [the validated live inventory](docs/live-api-inventory.md) for service-level
coverage from a Beam Gen 2. `api list` remains authoritative for the current
firmware.

## API boundary

The official Sonos Control API is cloud/OAuth based and focuses on household groups, playback, and volume. This CLI is local-first because home-theater EQ and device configuration are exposed by the players' local service descriptions. A future cloud adapter can be added without changing the high-level setting names.

## Output contract

- Successful command results: formatted JSON on stdout.
- Errors: one JSON object on stderr and a non-zero exit code.
- Discovery, services, actions, and setting names are sorted for reproducibility.
