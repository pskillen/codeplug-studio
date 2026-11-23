# Mode panels

## Purpose

One panel component per channel mode behind an exhaustive `MODE_PANELS` registry. **`ModePanel`** is the only way a page renders mode-specific settings (no per-mode `if` chains on routes).

## Props

| Prop      | Type                           | Description                         |
| --------- | ------------------------------ | ----------------------------------- |
| `profile` | `P extends ChannelModeProfile` | The mode profile being edited       |
| `onPatch` | `(patch: Partial<P>) => void`  | Partial profile update              |
| `context` | `ModePanelContext`             | Library, saved channel, frequencies |

### `ModePanelContext`

| Field          | Type              | Description                                                 |
| -------------- | ----------------- | ----------------------------------------------------------- |
| `library`      | `Library`         | Project library for selects and summaries                   |
| `savedChannel` | `Channel \| null` | Persisted channel row (e.g. BrandMeister sync); null on new |
| `rxFrequency`  | `number \| null`  | Live RX Hz for DMR operating mode hints                     |
| `txFrequency`  | `number \| null`  | Live TX Hz for DMR operating mode hints                     |
| `compact`      | `boolean`         | Phone layout: two-up field rows stack                       |

`ProfileFor<M>` distributes over the profile union so the registry can type each mode’s panel. `MODE_PANELS` must list every `ChannelMode` or `tsc` fails.

## Usage

```tsx
import ModePanel from '@app/components/channels/modePanels/ModePanel.tsx';

<ModePanel profile={profile} onPatch={onPatch} context={context} />;
```

## Behaviour

Digital modes use **`DigitalModeGroups`** — fixed order **Access / Call / Listen / You**:

| Mode   | Access                           | Call                  | Listen                         | You                      |
| ------ | -------------------------------- | --------------------- | ------------------------------ | ------------------------ |
| DMR    | Colour code + timeslot, DMR mode | Talk group or contact | RX group list + summary + sync | DMR ID, talker alias     |
| NXDN   | RX/TX RAN, rate                  | Call                  | RX group list                  | Unit ID                  |
| D-STAR | RPT1, RPT2                       | UR call               | note (repeater-wide listen)    | note (callsign on radio) |
| YSF    | DG-ID                            | WIRES-X DTMF ID       | note (same DG-ID)              | note (callsign on radio) |
| Tetra  | MCC + MNC, colour code           | Talk group, GSSI      | note (talk group)              | note (ISSI on radio)     |
| P25    | pending: note only               | heading only          | heading only                   | heading only             |
| M17    | pending: note only               | heading only          | heading only                   | heading only             |

- Empty groups show a muted one-line **note** (or heading only when `note: ''`).
- **Analogue** (FM, AM, SSB): no group headings; order is sideband (SSB), **TX then RX tone**, bandwidth, squelch, squelch mode.
- **`compact`**: two-up rows (`TwoUp`) become a vertical stack below 48em.
- Panels never render a mode header, pill, or primary-mode control — the parent page owns those.

### `DigitalModeGroups` and `TwoUp`

| Piece                     | Detail                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `DigitalModeGroups` props | `access`, `call`, `listen`, `you` — each a **`GroupContent`**                                                                 |
| `GroupContent`            | React node(s) wrapped in `.groupFields`, or `{ note: string }` for a muted one-line note; `{ note: '' }` renders heading only |
| `TwoUp`                   | `{ compact, children }` — side-by-side fields at `Group` grow; stacks with `Stack gap={14}` when `compact`                    |

### Adding a mode

1. Add the profile type in `src/core/models/library.ts` and `defaultModeProfile` in core.
2. Create `<Mode>ModePanel.tsx` using `DigitalModeGroups` (or analogue layout).
3. Register it in `MODE_PANELS`.
4. Add tests and a row in the table above.
5. When the summary and talk-sentence builders exist, add the mode's `case` to both.
6. No route edits if the parent already maps `modeProfiles` through `ModePanel`.

## Related

- [ChannelModeProfilesEditor.md](../ChannelModeProfilesEditor.md) — stacked wrapper with mode headers
- [channel-modes.md](../../../../docs/features/library/channel-modes.md) — tier-1 deep dive
