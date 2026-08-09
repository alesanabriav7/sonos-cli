# sonos-cli

`sonosctl` is a deterministic, local-first JSON CLI for humans and LLM agents
to inspect and configure Sonos. It discovers the current player's UPnP/SOAP
capabilities instead of relying on a frozen firmware API list.

The default interface is non-interactive: JSON goes to stdout, structured
errors go to stderr, and the exit code is non-zero on failure.

## Quick start

Requirements: Node.js 22+, pnpm 10+, and Bun to create the standalone binary.

```bash
pnpm install
pnpm check
pnpm package
./dist/sonosctl --help
```

Use the binary directly:

```bash
./dist/sonosctl capabilities
./dist/sonosctl discover
./dist/sonosctl status
```

Global options must precede the command:

```bash
./dist/sonosctl --host 192.168.1.50 --compact get bass
```

## Safe mutation workflow

Always plan a change before applying it:

```bash
# 1. Inspect the accepted types, ranges, and writeability.
./dist/sonosctl capabilities

# 2. Validate and compare against live state. This never calls the setter.
./dist/sonosctl set bass 5 --dry-run

# 3. Apply only after receiving authority for this exact change.
./dist/sonosctl set bass 5 --confirm bass

# 4. Independently read the resulting state when additional proof is needed.
./dist/sonosctl get bass
```

A dry-run result is explicit:

```json
{
  "ok": true,
  "data": {
    "operation": "set_setting",
    "outcome": "dry_run",
    "setting": "bass",
    "before": 4,
    "requested": 5,
    "after": null,
    "changed": true,
    "dryRun": true,
    "sideEffect": "none",
    "wouldCall": "RenderingControl.SetBass"
  }
}
```

Applying a high-level setting performs GET → SOAP setter → GET. Success is
reported only if readback equals the requested value. If the current value
already matches, the result is `outcome: "unchanged"` and no setter is called.

## LLM command contract

Prefer these stable commands in this order:

| Intent | Command | Network | Side effect |
|---|---|---:|---:|
| Learn accepted settings | `capabilities` | No | None |
| Locate players | `discover` | LAN reads | None |
| Read all common state | `settings` | LAN reads | None |
| Read one value | `get <setting>` | LAN read | None |
| Plan one change | `set <setting> <value> --dry-run` | LAN read | None |
| Apply one change | `set <setting> <value> --confirm <setting>` | LAN write | Explicit |
| Diagnose the coordinator | `doctor` | LAN reads | None |
| Capture current values | `snapshot` | LAN reads | None |
| Inspect firmware API | `api list/describe` | LAN reads | None |
| Plan raw SOAP | `api call ... --dry-run` | Schema read | None |

Agent rules:

1. Run `capabilities`; do not guess setting names, ranges, or enum values.
2. Use the high-level `get`/`set` interface whenever it covers the request.
3. Treat `--dry-run` as planning evidence, never as authority to apply.
4. Pass `--confirm` only when the caller authorized that exact mutation.
5. Parse `ok`, then use `data.outcome`, `data.sideEffect`, and `data.changed`.
6. Never report a change from `dry_run`, `unchanged`, or an error result.
7. Do not use raw destructive actions without separate explicit authority and
   a rollback plan.

Use `--compact` to emit single-line JSON and reduce tokens:

```bash
./dist/sonosctl --compact capabilities
```

## Device selection

Discovery selects the only soundbar when possible. If selection is ambiguous,
the command returns `DEVICE_SELECTION_REQUIRED`. Run `discover`, choose the
home-theater coordinator, and put `--host <ip>` before the next command.

Sonos addresses can change through DHCP. Discover on each workflow rather than
persisting an observed IP as durable configuration.

## High-level settings

`capabilities` is the machine-readable source of truth. Current names include:

- `volume`, `mute`, `group_volume`, `group_mute`
- `bass`, `treble`, `loudness`
- `sub_enabled`, `sub_gain`, `sub_polarity`
- `surrounds_enabled`, `surround_tv_level`, `surround_music_level`
- `surround_music_full` (`ambient` or `full`)
- `night_mode`, `speech_enhancement`, `tv_dialog_sync`, `height_level`
- `status_light`, `button_lock`, `ir_repeater`, `ir_led_feedback`
- `room_calibration`
- `output_fixed` (read-only)

Firmware support is still checked against the selected device at runtime.

## Live API inventory and raw SOAP

The expert interface enumerates all device-declared services and actions:

```bash
./dist/sonosctl api list
./dist/sonosctl api describe RenderingControl SetBass
./dist/sonosctl api call RenderingControl GetBass --arg InstanceID=0
```

Plan any raw action without invoking its SOAP endpoint:

```bash
./dist/sonosctl api call RenderingControl SetBass \
  --arg InstanceID=0 --arg DesiredBass=4 --dry-run
```

Raw writes require exact acknowledgement:

```bash
./dist/sonosctl api call RenderingControl SetBass \
  --arg InstanceID=0 --arg DesiredBass=4 \
  --allow-write --confirm SetBass
```

Actions classified as destructive additionally require
`--allow-destructive`. Risk classification is conservative but partly based on
action names; the high-level interface is safer. A successful raw write reports
`outcome: "write_accepted"` and `sideEffect: "accepted"`, not verified state,
because raw actions do not have a generic readback contract.

See [the validated live inventory](docs/live-api-inventory.md). `api list`
remains authoritative for the selected firmware.

## JSON and exit-code contract

Successful result:

```json
{"ok":true,"data":{}}
```

Failure on stderr with a non-zero exit code:

```json
{
  "ok": false,
  "error": {
    "code": "CONFIRMATION_REQUIRED",
    "message": "Write requires --confirm bass",
    "hint": "Run with --dry-run first, then pass the exact confirmation token."
  }
}
```

The CLI never asks interactive questions. Callers must not infer success from
an empty stdout, process silence, or a previous dry-run.

## Snapshots and rollback boundary

`snapshot` captures readable high-level values but v0.2 does not provide bulk
restore or automatic rollback. A failed readback is reported as failure; it
does not prove whether the downstream device retained a partial change. Read
the setting again before deciding whether a retry is safe.

## API boundary

The official Sonos Control API uses cloud OAuth and focuses on households,
groups, playback, and volume. This CLI is local-first because home-theater EQ
and device configuration are exposed by local device service descriptions.

- [Sonos Control API overview](https://docs.sonos.com/reference/about-control-api)
- [Sonos authorization](https://docs.sonos.com/docs/authorize)

## Development

```bash
pnpm dev -- --help
pnpm biome check .
pnpm typecheck
pnpm test
pnpm build
pnpm package
```

Tests use injected HTTP clients and never contact a real Sonos system.
