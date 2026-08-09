# Sonos CLI contract

- Keep the CLI local-first and deterministic. Do not add telemetry or cloud dependencies.
- Read capabilities from each player's live device and SCPD documents instead of assuming firmware support.
- High-level writes must validate input, read before writing, require explicit confirmation, and read back after writing.
- Raw SOAP writes require explicit risk acknowledgement. Destructive actions require a second acknowledgement.
- Tests must never target a real Sonos device or depend on LAN availability.
- Keep machine output stable JSON on stdout and errors on stderr.
- Use English identifiers and documentation. Use pnpm for dependency and script execution.

