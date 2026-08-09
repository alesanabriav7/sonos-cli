# Sonos CLI agent contract

## Purpose

This repository provides a deterministic local Sonos interface for humans and
LLM agents. Keep it local-first, non-interactive, JSON-native, typed, and free
of telemetry or cloud dependencies.

## Operating protocol

Use this state machine for any Sonos mutation:

```text
DISCOVERED -> INSPECTED -> PLANNED -> AUTHORIZED -> APPLIED -> VERIFIED
```

1. `DISCOVERED`: run `sonosctl discover`; never assume a DHCP address.
2. `INSPECTED`: run `sonosctl capabilities` and `get`/`settings`.
3. `PLANNED`: run the exact `set ... --dry-run` command.
4. `AUTHORIZED`: obtain authority for that exact setting and value. A dry-run
   or general troubleshooting request is not mutation authority.
5. `APPLIED`: repeat the command with `--confirm <exact-setting>`.
6. `VERIFIED`: require `outcome: "changed"`, `sideEffect: "completed"`, and
   matching `after`/`requested`, or independently run `get`.

Stop at `PLANNED` when write authority is absent. Never describe `dry_run` or
`unchanged` as a completed mutation.

## Command selection

- Prefer `capabilities`, `get`, `settings`, `set`, `status`, and `doctor`.
- Use `api list/describe` to inspect firmware-specific coverage.
- Use `api call` only when the stable high-level interface cannot express the
  requested operation.
- Treat raw `write_accepted` as SOAP acceptance, not state verification. Use a
  relevant read action for proof when one exists.
- Raw writes require explicit authority and exact `--allow-write --confirm`.
- Raw destructive writes require separate explicit authority,
  `--allow-destructive`, a resolved target, and a rollback plan.
- Never infer mutation authority from a request to inspect, diagnose, validate,
  explain, inventory, dry-run, or prepare commands.

## Machine interface

- Successful command output is `{ "ok": true, "data": ... }` on stdout.
- Failure is `{ "ok": false, "error": { "code", "message", "hint" } }` on
  stderr with a non-zero exit code.
- Use `--compact` for token-efficient one-line JSON.
- Parse fields; do not scrape help text or human prose.
- Treat `data.outcome` as the result discriminator and `data.sideEffect` as the
  side-effect evidence.
- Do not retry a failed mutation blindly. Read current state and classify
  whether the outcome is known before proposing another write.
- Pass subprocess arguments as an array. Do not interpolate untrusted setting,
  host, service, action, or value strings into a shell command.

## Implementation rules

- Read capabilities from live device and SCPD documents instead of assuming
  firmware support.
- High-level writes must validate, read before writing, require exact
  confirmation, write once, and verify by reading back.
- Every write path must provide a dry-run path that performs zero control SOAP
  calls. Prove this with an injected transport test.
- Raw SOAP calls must validate names, required inputs, enums, and numeric ranges
  against the live SCPD schema before invocation.
- Keep outputs stable and discriminated across dry-run, unchanged, completed,
  rejected, and uncertain outcomes. Do not collapse them into generic success.
- Tests must never contact the LAN or a real Sonos device.
- Use English identifiers and documentation and pnpm for project commands.
- Add exact dependency versions only; do not add telemetry or secrets.
- Keep user IPs, serials, household IDs, OAuth tokens, and credentials out of
  source, fixtures, snapshots, logs, and commits.

## Required proof for TypeScript changes

Run all of the following before claiming completion:

```bash
pnpm biome check .
pnpm typecheck
pnpm test
pnpm build
pnpm package
```

Also confirm changed TypeScript files belong to `tsconfig.json`, inspect
`git diff --check`, and use a read-only live smoke test only when LAN behavior
changed. Never use a real setting write as a smoke test.
