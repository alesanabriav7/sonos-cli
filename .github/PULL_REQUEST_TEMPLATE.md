## Change

Describe the user-visible behavior and why it belongs in sonosctl.

## Safety contract

- [ ] Reads and writes remain distinguishable.
- [ ] New write paths require exact confirmation.
- [ ] Dry-run performs zero control SOAP calls.
- [ ] Outputs distinguish completed, accepted, rejected, and unknown outcomes.
- [ ] Fixtures contain no IPs, serials, household IDs, tokens, or credentials.

## Proof

- [ ] `pnpm biome check .`
- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`
- [ ] `pnpm package`

Include tests and sanitized output for each material result branch.

