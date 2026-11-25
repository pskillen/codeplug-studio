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

| Mode   | Access                      | Call               | Listen        | You                  |
| ------ | --------------------------- | ------------------ | ------------- | -------------------- |
| DMR    | colour code, slot, DMR mode | Talk group/contact | RX group list | DMR ID, alias        |
| NXDN   | RAN, rate                   | Call               | RX group list | Unit ID              |
| D-STAR | RPT1, RPT2                  | UR call            | repeater-wide | callsign on radio    |
| YSF    | DG-ID                       | WIRES-X DTMF       | same DG-ID    | callsign on radio    |
| Tetra  | MCC/MNC, colour code        | Talk group, GSSI   | talk group    | ISSI on radio        |
| M17    | CAN, Play every CAN         | Destination        | CAN filter    | Default M17 callsign |
| P25    | pending note                | (headings only)    | (headings)    | (headings)           |

Choose **More → M17** in the mode picker. CAN accepts an integer from 0 to 15, with blank using 0. **Play every CAN** opens squelch for any CAN. It starts off, so the panel shows that the channel hears only its own CAN. The destination accepts up to nine letters, digits, hyphens, slashes, periods or spaces. Studio trims and uppercases it. Blank, `ALL` and `@ALL` call everyone. Enter a reflector module such as `M17-M17 A` as one destination. **You** shows the radio-wide default set in [Digital IDs](README.md#digital-ids).

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
| M17               | Calls **ECHO** on **CAN 3**. Broadcast displays as **ALL**.                              |
| P25               | Placeholder until settings exist in Studio.                                              |

Layout: one card for a single mode; two cards with **Main mode** on the main profile when there are two; three or more collapse to one summary row per mode that expands to the sentence. UI rules: [Talk cards](../../reference/styleguide/channel-modes-ui.md#talk-cards-channel-view).

## Decisions

Why the channel modes look the way they do.

- **One mode is one plain form.** Most channels run a single mode, so the editor shows the mode as a single switch with that mode's settings right underneath. A second mode is opt-in (**+ Also runs another mode**); only then do chips and per-mode sections appear. There is no separate "what kind of channel is this?" step.
- **A new channel starts with no mode.** Guessing FM would be wrong as often as it was right, so the editor asks, and offers one-tap presets for the common cases: **FM**, **DMR**, and **FM + DMR** (which makes FM the main mode, matching the label's order and what the editor would pick anyway).
- **"Main mode", not "primary" or "starts here".** What the field really controls is which mode a dual-mode radio transmits in when it listens to both, and which mode a one-mode radio keeps when it cannot hold two. It is not the mode the radio starts in, so "starts here" misled; "primary" meant nothing to most operators. The stored field keeps its name; only the words in the UI changed.
- **Make main never moves a section.** Sections stay in profile order when the main mode changes, so the page does not jump under the operator's finger. Only the badge and the button swap. Summaries, which are read rather than edited, do list the main mode first.
- **Mode changes are kept until save, and never stored.** Switching a channel from one mode to another remembers the old mode's settings in the editor, so switching back restores them and an accidental tap costs nothing. Nothing of the abandoned mode is saved. FM, AM and SSB share tones across a switch because those values mean the same thing in each; digital modes do not.
- **Every digital mode answers the same four questions.** Access, Call, Listen and You, in that order, so an operator who knows DMR can find the same things on NXDN or D-STAR. Analogue modes stay flat, with tones first, because they have no such questions to answer.
- **Where one-line summaries appear.** Wherever a channel is shown with room for detail: the channel table and cards, section headers, the view page when there are three or more modes, build channel previews (once per channel, not per expanded talk group) and map popups. They do not appear where space or purpose is tight: the phone list's identity line, zone member rows and entity pickers keep plain mode pills. Summaries add to a channel's callsign and name; they never replace them.
- **The view page answers "how do I talk on it".** A person opening a channel to use it wants a sentence, not a form read-back, so each mode gets one plain sentence with the dial values in bold and the remaining facts underneath.
- **Accepted exception: vendor wording.** The APRS binding section, wire-name examples and power hints may use a vendor's own words, because those values only make sense in the vendor's terms. Do not copy the pattern into new library fields.

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
