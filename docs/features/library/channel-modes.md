# Channel modes in the library editor

How the channel editor presents each mode on a channel and how mode profiles relate to export. Field semantics stay vendor-neutral; per-format wire mapping lives under [export-formats](../../reference/export-formats/).

## Purpose

A library channel may carry one or more **mode profiles** (`Channel.modeProfiles`). The editor shows a stacked block per profile: a mode header on the page, then that mode’s panel (`modePanels/`). This doc covers presentation and grouping — not CPS column names.

## Mode profiles

- One `ChannelModeProfile` per selected mode; **order is kept** and affects how operators read the channel.
- **`primaryMode`** is the **main mode**: what a single-mode radio keeps, and what a dual-mode radio transmits in. Format builds map `primaryMode` at export; see [builds](../builds/README.md).
- Defaults and validation live in `@core/domain/modeProfiles.ts`; the UI reads and patches typed fields only.

## Access, Call, Listen, You

Every **digital** mode’s settings answer the same four questions in the same order:

| Group  | Meaning                                              |
| ------ | ---------------------------------------------------- |
| Access | What opens the repeater (codes, RAN, DG-ID, …)       |
| Call   | Who you talk to (contact, talk group, UR call, …)    |
| Listen | What else you hear (RX lists, or a short note)       |
| You    | What the radio sends about you (own ID, alias, note) |

**Per-mode layout** (labels only — no wire values):

| Mode    | Access               | Call               | Listen        | You               |
| ------- | -------------------- | ------------------ | ------------- | ----------------- |
| DMR     | CC, slot, DMR mode   | Talk group/contact | RX group list | DMR ID, alias     |
| NXDN    | RAN, rate            | Call               | RX group list | Unit ID           |
| D-STAR  | RPT1, RPT2           | UR call            | repeater-wide | callsign on radio |
| YSF     | DG-ID                | WIRES-X DTMF       | same DG-ID    | callsign on radio |
| Tetra   | MCC/MNC, colour code | Talk group, GSSI   | talk group    | ISSI on radio     |
| P25/M17 | pending note         | (headings only)    | (headings)    | (headings)        |

**Analogue** modes (FM, AM, SSB) have **no** group headings: tones first (TX then RX), then bandwidth and squelch controls.

Mode labels and colours: [display — Channel modes](../../reference/styleguide/display.md#channel-modes). UI conventions: [channel-modes-ui](../../reference/styleguide/channel-modes-ui.md).

## Code anchors

- `src/app/components/channels/modePanels/` — `MODE_PANELS`, `ModePanel`, `DigitalModeGroups`
- Sidecar: [ModePanels.md](../../../src/app/components/channels/modePanels/ModePanels.md)
- Wrapper: [ChannelModeProfilesEditor](../../../src/app/components/channels/ChannelModeProfilesEditor.tsx)

## Related

- [Library CRUD hub](README.md)
- [channel-modes.md](../../reference/channel-modes.md) — domain labels and mode taxonomy (tier 2)
