# Browser radio read / write

In-browser read and write of handheld radios over **Web Serial** (and related transports such as BLE), so operators can program a radio without leaving Studio after assembling a format build. File export (CSV, `.neonplug`, YAML) remains first-class; Studio does not claim to replace vendor CPS as the only path.

**Tracking:** Epic [#594](https://github.com/pskillen/codeplug-studio/issues/594) · Spike [#603](https://github.com/pskillen/codeplug-studio/issues/603)

**Constitution:** [DESIGN.md](../../../DESIGN.md) — intentional browser radio I/O with attribution to CHIRP / NeonPlug lineages.

**Layer rule:** library and domain stay vendor-neutral. Binary protocols, baud/handshake, and memory maps live in `src/integrations/radio-io/` and tier-3 `docs/reference/<family>/` — never in core models or library CRUD.

## Implementation status

| Area | Status | Notes |
| --- | --- | --- |
| DESIGN intentional goal + attributions stubs | Shipped | [#595](https://github.com/pskillen/codeplug-studio/issues/595), [#597](https://github.com/pskillen/codeplug-studio/issues/597) |
| Architecture spike (protocol kit boundaries) | Documented | [#603](https://github.com/pskillen/codeplug-studio/issues/603) — see [protocol-kit-architecture.md](protocol-kit-architecture.md) |
| WebSerial transport + protocol kit | Not started | Child tickets after spike |
| First radio path (UV-5R Mini) | Not started | NeonPlug + CHIRP ground truth |
| Firmware-gated write | Deferred | Supported catalog [#613](https://github.com/pskillen/codeplug-studio/issues/613) |
| In-flow attribution chrome | Deferred | Stubs on `/attributions`; banners with first write UI |

## Documentation map

| Doc | Contents |
| --- | --- |
| [browser-radio-io-progress.md](browser-radio-io-progress.md) | Program progress for epic #594 |
| [browser-radio-io-outstanding.md](browser-radio-io-outstanding.md) | Open debt with linked issues |
| [protocol-kit-architecture.md](protocol-kit-architecture.md) | Spike deep-dive — kit vs per-radio modules |

Tier-3 protocol stubs: [baofeng-uv5r-mini](../../reference/baofeng-uv5r-mini/README.md) (full wire tables with first adapter ticket).

## Concepts

| Concept | Meaning |
| --- | --- |
| **Transport** | Browser byte pipe (Web Serial, optional BLE) — port request, baud, timeouts |
| **Protocol kit** | Reusable session, codecs (S/X, PROGRAM+R/W, …), `MemoryMap`, progress |
| **Radio module** | Per-model descriptor, handshake, image layout, encode/decode |
| **Clone image** | Contiguous (or sparse-assembled) memory dump decoded offline |
| **V-frame** | Discrete probe/info frames (e.g. DM-32) — not the kit’s default shape |

## Related

- [import-export hub](../import-export/README.md) — CPS file interchange (sibling concern)
- [CHIRP CSV](../import-export/chirp/README.md) — file path for UV-5R / UV-21 / RT95 profiles
- [NeonPlug interchange](../import-export/neonplug/README.md) — `.neonplug` ZIP preferred path before direct write
- NeonPlug ground truth: workspace `NeonPlug/src/radios/`
- CHIRP drivers: workspace `chirp/chirp/drivers/`
