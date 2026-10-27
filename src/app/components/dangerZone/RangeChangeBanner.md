# RangeChangeBanner

## Purpose

The red "Unfinished range change" banner (Danger zone, #1369). A range change wipes the radio until Restore finishes; if the page was closed in that window, this banner brings the user back. It reads the range-change journal (browser storage, no backup bytes) and shows one line and a button for each record at `sending`, `changed` or `restored`.

## Props

| Prop      | Type     | Notes                                                                                  |
| --------- | -------- | -------------------------------------------------------------------------------------- |
| `buildId` | `string` | The build whose route the button opens (`…/export/danger-zone/frequency-range/resume`) |
| `serial`  | `string` | Optional. Show only this radio's record. Default: every unfinished record              |

## Usage

```tsx
<RangeChangeBanner buildId={build.id} />
```

## Behaviour

- Copy: "Unfinished range change. AT-D890UV (serial) was changed to <range> at <time> and hasn't been restored. Its channels and settings may be wiped." with **Resume**. A record at `restored` reads "…and restored, but not checked." with **Check**.
- **Resume** opens the wizard's resume path with the serial in router state (not in the URL). The wizard then asks for the saved backup file and checks its SHA-256 against the record.
- **Dismiss this record** forgets the record, behind a confirm that says the banner and Resume go away, the radio is not touched, and the backup files stay. For a record that was finished another way (the Backup / Restore fallback) or a radio that is gone.
- Renders nothing when there is no unfinished record, when storage is unavailable, or for a `done` record.
- Shown on the Danger zone page, above the AT-D890 Export panel's header card, and on Backup / Restore.
- Phone width: the button stacks under the text, full width.

## Related

- [danger-zone.md](../../../../docs/features/radio-read-write/danger-zone.md)
