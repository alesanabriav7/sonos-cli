# Changelog

All notable changes are documented here. The project follows Semantic
Versioning.

## [0.2.0] - 2026-08-09

### Added

- Machine-readable `capabilities` for 24 stable high-level settings.
- Zero-write `--dry-run` for high-level settings and raw SOAP actions.
- Stable `ok/data` and `ok/error` JSON envelopes with actionable error codes.
- `--compact` output for token-efficient agent calls.
- Explicit `OUTCOME_UNKNOWN` handling for writes that cannot be verified.
- Read-before-write and readback verification for high-level mutations.
- Live SCPD inventory and validation for firmware-declared SOAP actions.

### Safety

- Exact confirmation is required for high-level and raw writes.
- Destructive raw actions require a second acknowledgement.
- Raw write success is reported as accepted, not verified state.

[0.2.0]: https://github.com/alesanabriav7/sonos-cli/releases/tag/v0.2.0

