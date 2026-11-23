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

| Mode    | Access                      | Call               | Listen        | You               |
| ------- | --------------------------- | ------------------ | ------------- | ----------------- |
| DMR     | colour code, slot, DMR mode | Talk group/contact | RX group list | DMR ID, alias     |
| NXDN    | RAN, rate                   | Call               | RX group list | Unit ID           |
| D-STAR  | RPT1, RPT2                  | UR call            | repeater-wide | callsign on radio |
| YSF     | DG-ID                       | WIRES-X DTMF       | same DG-ID    | callsign on radio |
| Tetra   | MCC/MNC, colour code        | Talk group, GSSI   | talk group    | ISSI on radio     |
| P25/M17 | pending note                | (headings only)    | (headings)    | (headings)        |

**Analogue** modes (FM, AM, SSB) have **no** group headings: tones first (TX then RX), then bandwidth and squelch controls.

Mode labels and colours: [display — Channel modes](../../reference/styleguide/display.md#channel-modes). UI conventions: [channel-modes-ui](../../reference/styleguide/channel-modes-ui.md).

## Summaries

A **mode summary** is one line of library values for a single profile — talk-group numbers, colour codes, tones, and similar fields — never CPS wire strings or format names. `channelModeSummary.ts` builds the text; `ModeSummaryChip` and `ChannelModeSummaries` render it.

Summaries appear **after** the channel's callsign and name (they do not replace identity):

- Channel list table **Name** cell and optional **Mode** column (table and cards)
- Build channel wire-preview rows (not per-talk-group expansion rows)
- Map popups when the caller passes a library lookup
- Later: channel view header and folded editor sections (follow-on phases)

They do **not** appear on the phone list identity line (plain joined mode pills only, main mode bordered), zone member rows, or entity pickers — those keep `ModePill`.

With two or more modes, the **main mode** (`primaryMode` when valid, else the first profile) is listed first and drawn with a coloured border. Rules and examples: [display — Mode summaries](../../reference/styleguide/display.md#mode-summaries).

## Code anchors

- `src/app/lib/channelModeSummary.ts` — summary text per profile
- `src/app/components/channels/ModeSummaryChip.tsx`, `ChannelModeSummaries.tsx`
- `src/app/components/channels/modePanels/` — `MODE_PANELS`, `ModePanel`, `DigitalModeGroups`
- Sidecar: [ModePanels.md](../../../src/app/components/channels/modePanels/ModePanels.md)
- Wrapper: [ChannelModeProfilesEditor](../../../src/app/components/channels/ChannelModeProfilesEditor.tsx)

## Related

- [Library CRUD hub](README.md)
- [channel-modes.md](../../reference/channel-modes.md) — domain labels and mode taxonomy (tier 2)
