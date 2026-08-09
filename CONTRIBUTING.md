# Contributing

Thanks for helping make local Sonos automation safer and more deterministic.

## Start with evidence

- Bugs need a minimal command, redacted JSON output, Sonos model, firmware, and
  platform.
- Device support reports must use reads or dry-runs. Do not test writes merely
  to collect compatibility evidence.
- Feature requests should explain the stable high-level setting or the live
  SCPD action they need.

Never include IP addresses, serial numbers, household IDs, credentials, OAuth
tokens, private topology snapshots, or unredacted device output.

## Development

Requirements: Node.js 22+, pnpm 10+, and Bun.

```bash
pnpm install
pnpm check
pnpm package
./dist/sonosctl --compact capabilities
```

Tests use injected transports and must not contact a real Sonos system.

## Pull requests

Keep changes small, typed, and deterministic. Add tests for validation
boundaries, every material output branch, and side-effect classification. A new
write path must include an exact confirmation gate, a zero-write dry-run, and
readback when the domain exposes one.

Use conventional commit subjects such as `feat:`, `fix:`, `docs:`, or `test:`.
By contributing, you agree that your contribution is licensed under the MIT
License.

