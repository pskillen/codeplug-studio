# Channel modes in the library editor

How the channel editor presents each mode on a channel and how mode profiles relate to export. Field semantics stay vendor-neutral; per-format wire mapping lives under [export-formats](../../reference/export-formats/).

## Purpose

A library channel may carry one or more **mode profiles** (`Channel.modeProfiles`). The editor shows a stacked block per profile: a mode header on the page, then that mode’s panel (`modePanels/`). This doc covers presentation and grouping — not CPS column names.

## Mode profiles

- One `ChannelModeProfile` per selected mode; **order is kept** and affects how operators read the channel.
- **`primaryMode`** is the **main mode**: what a single-mode radio keeps, and what a dual-mode radio transmits in. Format builds map `primaryMode` at export; see [builds](../builds/README.md).
- Defaults and validation live in `@core/domain/modeProfiles.ts`; the UI reads and patches typed fields only.

## Single, dual and multi-mode

- **One mode:** the channel editor reads as a plain form — the mode picker sits with RX/TX and that mode's settings sit directly underneath, with **+ Also runs another mode** as the only hint that a second mode exists.
- **New channel:** no mode until the operator picks one or taps a preset (FM, DMR, FM + DMR). A dashed placeholder asks "Which mode does this channel use?"
- **Two or more modes:** removable chips in **Mode and frequency**; each mode has its own collapsible section in **Modes** ([`ModeSection`](../../../src/app/components/channels/ModeSection.md)).
- **Switching** keeps the previous mode's profile in editor memory until save; switching back restores it without marking the form dirty. FM, AM and SSB carry tones across mode switches; digital modes do not. Profile order changes only by append, in-place switch (0–1 modes), or removal.

## Main mode

When a channel has two or more profiles, the main mode's section shows a **Main mode** badge; every other section has a **Make main** button. Both explain on hover or focus: a radio that can use only one of the channel's modes keeps the main one; a radio that listens to both transmits in it. That choice is `primaryMode` (defaults to the first profile when unset). Sections stay in profile order when the main mode changes. If the main mode is removed, `reconcilePrimaryMode` passes leadership to the first remaining profile.

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

**Analogue** modes (FM, AM, SSB) have **no** group headings: tones first (TX then RX), then bandwidth and squelch controls. Each tone field remembers its last CTCSS and DCS choices for the open edit session only (switching Off or between kinds restores them; save and refresh do not).

Mode labels and colours: [display — Channel modes](../../reference/styleguide/display.md#channel-modes). UI conventions: [channel-modes-ui](../../reference/styleguide/channel-modes-ui.md).

## Summaries

A **mode summary** is one line of library values for a single profile — talk-group numbers, colour codes, tones, and similar fields — never CPS wire strings or format names. `channelModeSummary.ts` builds the text; `ModeSummaryChip` and `ChannelModeSummaries` render it.

Summaries appear **after** the channel's callsign and name (they do not replace identity):

- Channel list table **Name** cell and optional **Mode** column (table and cards)
- Build channel wire-preview rows (not per-talk-group expansion rows)
- Map popups when the caller passes a library lookup

They do **not** appear on the phone list identity line (plain joined mode pills only, main mode bordered), zone member rows, or entity pickers — those keep `ModePill`.

With two or more modes, the **main mode** (`primaryMode` when valid, else the first profile) is listed first and drawn with a coloured border. Rules and examples: [display — Mode summaries](../../reference/styleguide/display.md#mode-summaries).

## How to talk on it

The channel **view** page (`ChannelViewPage`) answers how to use each mode, not only what is set. `modeTalk.ts` builds one sentence per profile from library values; `ChannelTalkCard` renders it with bold dial values, leftover facts from `modeProfileFacts`, and the RX group list brief when present.

| Mode              | Sentence (unset clauses dropped)                                                         |
| ----------------- | ---------------------------------------------------------------------------------------- |
| FM / AM, repeater | TX tone to open; then whether the repeater sends a tone back (same, different, or none). |
| FM / AM, simplex  | Talk direct; optional TX tone.                                                           |
| FM / AM, RX only  | Receive only.                                                                            |
| SSB               | Upper or lower sideband.                                                                 |
| DMR               | Talk group or private call, timeslot, colour code; optional RX list sentence.            |
| NXDN              | Talk group or private call and RAN (split TX/RX RAN when they differ); optional RX list. |
| D-STAR            | UR call, optional RPT1 gateway.                                                          |
| YSF               | DG-ID when set.                                                                          |
| Tetra             | Talk group (or GSSI), optional MCC-MNC network.                                          |
| P25 / M17         | Placeholder until settings exist in Studio.                                              |

Layout: one card for a single mode; two cards with **Main mode** on the main profile when there are two; three or more collapse to one summary row per mode that expands to the sentence. UI rules: [Talk cards](../../reference/styleguide/channel-modes-ui.md#talk-cards-channel-view).

## Code anchors

- `src/app/lib/channelModeSummary.ts` — summary text per profile
- `src/app/routes/library/channelView/modeTalk.ts` — view-page talk sentences
- `src/app/routes/library/channelView/ChannelTalkCard.tsx` — talk card UI on the view page
- `src/app/components/channels/ModeSummaryChip.tsx`, `ChannelModeSummaries.tsx`
- `src/app/components/channels/modePanels/` — `MODE_PANELS`, `ModePanel`, `DigitalModeGroups`
- Sidecar: [ModePanels.md](../../../src/app/components/channels/modePanels/ModePanels.md)
- Picker: [ChannelModePicker.md](../../../src/app/components/channels/ChannelModePicker.md)

## Related

- [Library CRUD hub](README.md)
- [channel-modes.md](../../reference/channel-modes.md) — domain labels and mode taxonomy (tier 2)
