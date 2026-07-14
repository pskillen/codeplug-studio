# APRS (digital)

Tier-1 hub for **digital APRS** in Codeplug Studio — vendor-neutral library entities, per-channel bindings, and a **singleton** global configuration. Wire column mapping lives in per-format tier-3 references; this doc describes internal semantics only.

**Tracking:** [#353](https://github.com/pskillen/codeplug-studio/issues/353) (persistence) · [#354](https://github.com/pskillen/codeplug-studio/issues/354) (UI) · [#248](https://github.com/pskillen/codeplug-studio/issues/248) (reconciliation) · Epic [#246](https://github.com/pskillen/codeplug-studio/issues/246)

**Progress:** [aprs-model-progress.md](aprs-model-progress.md) · **Outstanding:** [aprs-model-outstanding.md](aprs-model-outstanding.md)

**Components:** [AprsChannelSlotsEditor](../../../src/app/components/library/AprsChannelSlotsEditor.md) · [ChannelAprsBindingSection](../../../src/app/components/library/ChannelAprsBindingSection.md) · [AprsChannelAssignmentPanel](../../../src/app/components/library/AprsChannelAssignmentPanel.md)

---

## Scope

| In scope (this epic)                                                                                 | Out of scope                                                                                  |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Digital DMR-over-APRS configuration and per-channel flags                                            | Analog (AX.25) APRS — not modelled; exporters emit off/default constants                      |
| Library `aprsConfiguration` (singleton) + `Channel.aprs?`                                            | OpenGD77 APRS (analog-only) — deferred                                                        |
| Native YAML persistence + domain validation (schema v17)                                             | OpenGD77 APRS (analog-only) — deferred                                                        |
| IndexedDB `aprsConfigurations` store (one row per project)                                           | DM32 per-channel APRS export — [#250](https://github.com/pskillen/codeplug-studio/issues/250) |
| Library settings page, channel APRS tab, bulk channel assignments, Channels list column              |                                                                                               |
| Cross-format reconciliation doc                                                                      |                                                                                               |
| Anytone `APRS.CSV` + channel export ([#251](https://github.com/pskillen/codeplug-studio/issues/251)) |                                                                                               |

**Analog-off export policy:** Anytone and DM32 analog APRS columns are not operator-editable. Export adapters fill them with fixture constants (`Off`, `0`, …) regardless of stale library data.

---

## Entities (summary)

| Entity               | Layer                       | Role                                                                                                                |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `AprsConfiguration`  | Library (singleton)         | Global digital APRS settings — beacon timing, position source, up to 8 channel slots (DMR, AM air, or FM broadcast) |
| `ChannelAprsBinding` | Library (on `Channel.aprs`) | Per-channel digital flags — receive, report type, PTT mode, `reportSlotIndex` (1-based)                             |

Deep field semantics: [data-model README](../data-model/README.md). Cross-format wire shapes: [cross-format-reconciliation.md](cross-format-reconciliation.md).

**No new build trait** — APRS does not change zone/scan/memory organisation.

**No radio caps in CRUD** — slot cardinality (e.g. 8 on AT-D890UV) is enforced at export with warnings only, matching `ScanList` patterns.

---

## Editing paths

| Path               | Route / location              | Purpose                                                                                                        |
| ------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **APRS settings**  | `/library/aprs-configuration` | Singleton config editor + **Channel assignments** tab (bulk binding; digital / analog / both and band filters) |
| **Channel editor** | Channel → APRS tab            | Per-channel binding (`ChannelAprsBindingSection`) — all channels (DMR and analog)                              |
| **Channels list**  | `/library/channels`           | Optional **APRS config** column (hidden by default) — summary via `formatAprsAssignmentSummary`                |

Redirects: `/library/aprs-configurations` → `/library/aprs-configuration`.

---

## Implementation status

| Area                                                                   | Status                                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Tier-1 + reconciliation docs                                           | Shipped ([#248](https://github.com/pskillen/codeplug-studio/issues/248)) |
| Core types + schema v15                                                | Shipped ([#249](https://github.com/pskillen/codeplug-studio/issues/249)) |
| Domain normalize / validation                                          | Shipped                                                                  |
| `assemble()` APRS projection                                           | Shipped                                                                  |
| Native YAML round-trip                                                 | Shipped                                                                  |
| IndexedDB persistence (`aprsConfigurations`, schema v16)               | Shipped ([#353](https://github.com/pskillen/codeplug-studio/issues/353)) |
| Singleton model + schema v17 migration                                 | Shipped                                                                  |
| Library APRS UI (settings page, channel tab, assignments, list column) | Shipped ([#354](https://github.com/pskillen/codeplug-studio/issues/354)) |
| Anytone export (`APRS.CSV`, channel cols, `aprsDefaults.ts`)           | Shipped ([#251](https://github.com/pskillen/codeplug-studio/issues/251)) |
| Anytone APRS slots on analog channels (AM air / FM broadcast)          | Shipped ([#359](https://github.com/pskillen/codeplug-studio/issues/359)) |
| DM32 per-channel APRS                                                  | Pending — [#250](https://github.com/pskillen/codeplug-studio/issues/250) |

---

## Related

- [data-model](../data-model/README.md) — ER diagram and entity tables
- [Anytone APRS wire inventory](../../reference/anytone/aprs.md) — tier 3
- [Anytone per-channel APRS](../../reference/anytone/aprs-on-channels.md) — tier 3
