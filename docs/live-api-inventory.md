# Live Sonos API inventory

Validated on 2026-08-09 against a Beam Gen 2 running software `96.0-79160`.
The device declared 16 service endpoints and 201 actions. Two endpoints use the
same `ConnectionManager` service type for different embedded devices.

| Service | Actions | Read | Write | Destructive |
|---|---:|---:|---:|---:|
| AlarmClock | 17 | 9 | 7 | 1 |
| AVTransport | 42 | 9 | 30 | 3 |
| ConnectionManager (renderer) | 3 | 3 | 0 | 0 |
| ConnectionManager (server) | 3 | 3 | 0 | 0 |
| ContentDirectory | 16 | 9 | 6 | 1 |
| DeviceProperties | 27 | 10 | 9 | 8 |
| GroupManagement | 4 | 0 | 3 | 1 |
| GroupRenderingControl | 6 | 2 | 4 | 0 |
| HTControl | 8 | 3 | 5 | 0 |
| MusicServices | 3 | 2 | 1 | 0 |
| QPlay | 1 | 0 | 1 | 0 |
| Queue | 11 | 1 | 8 | 2 |
| RenderingControl | 27 | 12 | 13 | 2 |
| SystemProperties | 17 | 3 | 11 | 3 |
| VirtualLineIn | 8 | 0 | 8 | 0 |
| ZoneGroupTopology | 8 | 3 | 4 | 1 |

Risk is classified conservatively from the action name. Any action that is not
recognizably read-only requires write confirmation; topology removal, resets,
firmware/configuration, credentials, bonds, satellites, and similar operations
receive the destructive gate where identifiable.

This file is evidence from one firmware version, not the runtime source of
truth. To enumerate every action, argument, allowed value, and numeric range on
the current device:

```bash
sonosctl api list
sonosctl api describe <service>
sonosctl api describe <service> <action>
```

The CLI fetches each service's live SCPD XML and validates raw calls against it.
That makes newly added actions inspectable without a release, while high-level
configuration writes remain explicitly allowlisted.

## Public cloud boundary

Sonos also offers an official OAuth 2.0 Control API for household discovery,
groups, playback, and volume. It does not replace the local device-declared
home-theater EQ/configuration surface used here.

- [Control API overview](https://docs.sonos.com/reference/about-control-api)
- [Authorization](https://docs.sonos.com/docs/authorize)
- [Control namespace](https://docs.sonos.com/docs/control)
- [Volume namespace](https://docs.sonos.com/docs/volume)

