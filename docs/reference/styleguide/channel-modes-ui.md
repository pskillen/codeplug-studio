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

## Picking a channel's mode

Most channels have one mode, so the mode is a single switch, not a multi-select (`ChannelModePicker`).

- **No mode yet:** a dashed box, "Which mode does this channel use?", with one-tap presets **FM** (Analogue), **DMR** (Digital) and **FM + DMR** (Dual-mode repeater), and the other modes beneath. One tap fills the mode; there is no confirm and no separate "what kind of channel?" step. A preset's first mode becomes the main mode.
- **One mode:** a single-select switch, FM AM DMR NXDN P25 M17, the rest under **More**. A second mode is opt-in, through **+ Also runs another mode** under that mode's settings.
- **Two or more modes:** one removable chip per mode (× to remove), then **+ Add another mode**.
- Chips are 32px tall with a 44px hit area; the switch wraps on a phone.
- Switching or removing a mode keeps its settings until save; switching back restores them.
