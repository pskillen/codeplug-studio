# Channel mode UI

How the library presents a channel's modes. Live demos: `/styleguide/channel-modes`. Mode labels and colours: [display.md — Channel modes](display.md#channel-modes).

## Mode summaries

List and map surfaces show one `ModeSummaryChip` per mode after the channel's identity, built by `ChannelModeSummaries` from `channelModeSummary.ts`. Rules and the per-mode summary table: [display.md — Mode summaries](display.md#mode-summaries).

## Mode settings: Access, Call, Listen, You

Every digital mode's settings use the same four groups, in this order (`DigitalModeGroups`):

| Group  | Answers                                   | DMR example                     |
| ------ | ----------------------------------------- | ------------------------------- |
| Access | What opens the repeater, and your squelch | Colour code, timeslot, DMR mode |
| Call   | Who you talk to                           | Talk group or contact           |
| Listen | What else you hear                        | RX group list                   |
| You    | What your radio sends about you           | DMR ID, talker alias            |

- A group a mode has no fields for keeps its heading and shows one muted line instead ("Your callsign is set on the radio."). A mode Studio holds no settings for yet shows the headings and one note.
- Analogue modes (FM, AM, SSB) have no group headings: tones first, then bandwidth and squelch.
- Two inputs that share a row stack below 48em.
- A mode panel never draws its own header, mode pill or main-mode control: the page around it does.
- No radio, format or CPS names in mode copy.
- Code: `src/app/components/channels/modePanels/` ([ModePanels.md](../../../src/app/components/channels/modePanels/ModePanels.md)).

## Mode sections and the main mode

With two or more modes, each mode gets its own section (`ModeSection`, a collapsible `Panel` with a stripe in the mode's colour).

- The main mode's header carries a **Main mode** badge; every other mode's a small **Make main** button. Both explain on hover or focus: "A radio that can use only one of these modes uses this one; a radio that listens to both transmits in it."
- Making a mode main never moves its section: sections jumping under the operator's finger is worse than the main mode sitting second.
- With three or more modes (two or more on a phone) every section except the main mode's starts folded to its one-line summary. A mode added during the edit starts open.
- Remove a mode from the chips (×), not from its section.
- Never call it "primary" or describe it through a radio or export format.

## Channel editor layout

The mode sits with the frequency, and its settings sit right under them (`ChannelEditor`):

1. Identity: callsign (with directory lookup) and name only.
2. Mode and frequency: the mode picker, RX, offset, TX, then (one mode) that mode's settings and
   **+ Also runs another mode**. With no mode yet, the settings area says "The mode's settings appear here once you
   pick it."
3. Modes (two or more modes only): one section per mode.
4. Transmit: power, forbid transmit, TX permit; folded on a phone with a one-line summary.
5. Names and notes, then Location, Zones, Scanning, APRS.

Library editors never explain a field by naming a radio or export format.

## Picking a channel's mode

Most channels have one mode, so the mode is a single switch, not a multi-select (`ChannelModePicker`).

- **No mode yet:** a dashed box, "Which mode does this channel use?", with one-tap presets **FM** (Analogue), **DMR** (Digital) and **FM + DMR** (Dual-mode repeater), and the other modes beneath. One tap fills the mode; there is no confirm and no separate "what kind of channel?" step. A preset's first mode becomes the main mode.
- **One mode:** a single-select switch, FM AM DMR NXDN P25 M17, the rest under **More**. A second mode is opt-in, through **+ Also runs another mode** under that mode's settings.
- **Two or more modes:** one removable chip per mode (× to remove), then **+ Add another mode**.
- Chips are 32px tall with a 44px hit area; the switch wraps on a phone.
- Switching or removing a mode keeps its settings until save; switching back restores them.

## Talk cards (channel view)

The view page answers "how do I use this channel?", not "what is set": one card per mode with a sentence, then
the small facts the sentence didn't use (`channelView/ChannelTalkCard.tsx`, sentences from `modeTalk`).

- The sentence puts the values an operator dials or reads in bold: "Talk on **TG 2351 Scotland**, timeslot
  **2**, colour code **1**." A clause whose field is unset is dropped, never shown as "—".
- Talk groups read number first, as operators dial them: "TG 2351 Scotland".
- Repeater or simplex wording comes from the frequencies, never from a radio setting.
- One mode: one card. Two: two cards, main mode first with the **Main mode** badge. Three or more: one compact row
  per mode with its summary chip, opening to the sentence.
- A mode with nothing set says so and links to that mode in the editor.
- No radio, format or CPS names in sentences.
