# Browser radio read / write

In-browser read and write of handheld radios over **Web Serial** (and related transports such as BLE), so operators can program a radio without leaving Studio after assembling a **radio build**. File export (CSV, `.neonplug`, YAML) remains first-class; Studio does not claim to replace vendor CPS as the only path.

**Tracking:** Epic [#594](https://github.com/pskillen/codeplug-studio/issues/594) · Spike [#603](https://github.com/pskillen/codeplug-studio/issues/603)

**Constitution:** [DESIGN.md](../../../DESIGN.md) — intentional browser radio I/O with attribution to CHIRP / NeonPlug lineages.

**Layer rule:** library and domain stay vendor-neutral. Binary protocols, baud/handshake, and memory maps live in `src/integrations/radio-io/` and tier-3 `docs/reference/<family>/` — never in core models or library CRUD.

## Implementation status

| Area                                          | Status     | Notes                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DESIGN intentional goal + attributions stubs  | Shipped    | [#595](https://github.com/pskillen/codeplug-studio/issues/595), [#597](https://github.com/pskillen/codeplug-studio/issues/597)                                                                                                                                                                                                                                                             |
| Architecture spike (protocol kit boundaries)  | Documented | [#603](https://github.com/pskillen/codeplug-studio/issues/603) — [protocol-kit-architecture.md](protocol-kit-architecture.md); children [#615](https://github.com/pskillen/codeplug-studio/issues/615)–[#619](https://github.com/pskillen/codeplug-studio/issues/619)                                                                                                                      |
| OpenGD77 binary memory reference              | Documented | [#623](https://github.com/pskillen/codeplug-studio/issues/623) — [radios/opengd77](../../reference/radios/opengd77/README.md); blocks adapters [#624](https://github.com/pskillen/codeplug-studio/issues/624)/[#625](https://github.com/pskillen/codeplug-studio/issues/625)                                                                                                               |
| UV-5R Mini binary memory reference            | Documented | [#627](https://github.com/pskillen/codeplug-studio/issues/627) — [radios/baofeng/uv-5r-mini](../../reference/radios/baofeng/uv-5r-mini/README.md); blocks adapter [#617](https://github.com/pskillen/codeplug-studio/issues/617)                                                                                                                                                           |
| DM-32UV binary memory reference               | Documented | [#637](https://github.com/pskillen/codeplug-studio/issues/637) — [radios/baofeng/dm-32uv](../../reference/radios/baofeng/dm-32uv/README.md); parent [#636](https://github.com/pskillen/codeplug-studio/issues/636)                                                                                                                                                                         |
| DM-32UV Web Serial adapter                    | Shipped    | [#638](https://github.com/pskillen/codeplug-studio/issues/638) — `radios/dm32uv/`; `radio-io-dm32uv` egress on `baofeng-dm32uv`; sparse `radio-clone` blocks; selective 4KB RMW write                                                                                                                                                                                                      |
| RT95 VOX binary memory reference              | Documented | [#642](https://github.com/pskillen/codeplug-studio/issues/642) — [radios/retevis/rt95](../../reference/radios/retevis/rt95/README.md); blocks adapter [#643](https://github.com/pskillen/codeplug-studio/issues/643); parent [#640](https://github.com/pskillen/codeplug-studio/issues/640)                                                                                                |
| AT-D890UV binary memory reference             | Documented | [#647](https://github.com/pskillen/codeplug-studio/issues/647) — [radios/anytone/at-d890uv](../../reference/radios/anytone/at-d890uv/README.md); blocks adapter [#649](https://github.com/pskillen/codeplug-studio/issues/649); parent [#645](https://github.com/pskillen/codeplug-studio/issues/645)                                                                                      |
| WebSerial transport + protocol kit            | Shipped    | [#615](https://github.com/pskillen/codeplug-studio/issues/615), [#616](https://github.com/pskillen/codeplug-studio/issues/616) — `transport/` + `kit/` (PROGRAM+R/W `BlockCodec`)                                                                                                                                                                                                          |
| Sibling kit codecs (V-probe, OpenGD77 serial) | Shipped    | [#630](https://github.com/pskillen/codeplug-studio/issues/630), [#631](https://github.com/pskillen/codeplug-studio/issues/631) — `kit/codecs/vProbe.ts`, `opengd77Serial.ts` (not `BlockCodec`)                                                                                                                                                                                            |
| First radio path (UV-5R Mini)                 | Shipped    | [#617](https://github.com/pskillen/codeplug-studio/issues/617) adapter + [#618](https://github.com/pskillen/codeplug-studio/issues/618); under [#654](https://github.com/pskillen/codeplug-studio/issues/654) Web Serial is a **radio-io egress** on the UV-5R Mini radio target — Read hydrates `EgressPath.hydration` (`radio-clone`); Write via `assemble`; no CPS file on that pathway |
| Firmware-gated write                          | Deferred   | [#619](https://github.com/pskillen/codeplug-studio/issues/619) ← catalog [#613](https://github.com/pskillen/codeplug-studio/issues/613)                                                                                                                                                                                                                                                    |
| In-flow attribution chrome                    | Shipped    | [#618](https://github.com/pskillen/codeplug-studio/issues/618) on `BuildRadioIoPanel`; stubs [#597](https://github.com/pskillen/codeplug-studio/issues/597)                                                                                                                                                                                                                                |

## Documentation map

| Doc                                                                | Contents                                                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| [adding-a-radio-adapter.md](adding-a-radio-adapter.md)             | Checklist for new Web Serial radio modules (living — update as we learn) |
| [browser-radio-io-progress.md](browser-radio-io-progress.md)       | Program progress for epic #594                                           |
| [browser-radio-io-outstanding.md](browser-radio-io-outstanding.md) | Open debt with linked issues                                             |
| [protocol-kit-architecture.md](protocol-kit-architecture.md)       | Spike deep-dive — kit vs per-radio modules                               |

Tier-3 protocol refs: [baofeng/uv-5r-mini](../../reference/radios/baofeng/uv-5r-mini/README.md) (PROGRAM+R/W binary; CSV / `.neonplug` ≠ clone) · [baofeng/dm-32uv](../../reference/radios/baofeng/dm-32uv/README.md) (V-frame + 4KB block R/W; CSV / `.neonplug` ≠ binary) · [retevis/rt95](../../reference/radios/retevis/rt95/README.md) (PROGRAM→QX binary; CSV ≠ clone) · [anytone/at-d890uv](../../reference/radios/anytone/at-d890uv/README.md) (Anytone DMR PROGRAM→QX + u32 sparse regions; CSV ≠ binary) · [OpenGD77 / OpenUV380 binary](../../reference/radios/opengd77/README.md) (memory + serial; CSV ≠ binary).

## Concepts

| Concept          | Meaning                                                                                                                                                         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Transport**    | Browser byte pipe (Web Serial, optional BLE) — port request, baud, timeouts                                                                                     |
| **Protocol kit** | Reusable session, codecs (PROGRAM+R/W, V-probe, OpenGD77 serial, …), `MemoryMap`, progress                                                                      |
| **Radio module** | Per-model descriptor, handshake, image layout, encode/decode                                                                                                    |
| **Clone image**  | Contiguous (or sparse-assembled) memory dump decoded offline                                                                                                    |
| **Hydration**    | Unmodelled / full-image state persisted on the **Web Serial `EgressPath`** (`hydration`) so write-back stays valid (same escape hatch as NeonPlug donor retain) |
| **V-frame**      | Discrete probe/info frames (e.g. DM-32) — not the kit’s default shape                                                                                           |

New adapters: follow [adding-a-radio-adapter.md](adding-a-radio-adapter.md). Write always goes through `RadioBuild` + active egress + `assemble`; MVP **Read** hydrates the egress (read-only settings), and does **not** import channels into the library.

## Related

- [import-export hub](../import-export/README.md) — CPS file interchange (sibling concern)
- [CHIRP CSV](../import-export/chirp/README.md) — file path for UV-5R / UV-21 / RT95 profiles
- [NeonPlug interchange](../import-export/neonplug/README.md) — `.neonplug` ZIP preferred path before direct write
- NeonPlug ground truth: workspace `NeonPlug/src/radios/`
- CHIRP drivers: workspace `chirp/chirp/drivers/`
