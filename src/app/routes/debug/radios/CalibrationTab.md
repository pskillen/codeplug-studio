# CalibrationTab

The shared Calibration tab shell for a radio debug page.

## Purpose

Calls the descriptor's `calibration(archive)` for the selected read and for the overlay read, and draws the results with the debug kit. It holds no radio text: the `CalibrationView` carries every sentence, address and caveat. The RT95 and the AT-D890UV are on it; the other radios keep their own `Calibration` component until K2 to K5.

## Props

| Prop             | Type                           | Notes                                                        |
| ---------------- | ------------------------------ | ------------------------------------------------------------ |
| `archive`        | `DebugArchive \| undefined`    | The page's selected read                                     |
| `overlayArchive` | `DebugArchive \| undefined`    | The overlay read (the page's `compareId` entry)              |
| `calibration`    | `(archive) => CalibrationView` | The descriptor's radio-home builder                          |
| `entries`        | `{ id, label, readAt }[]`      | The read history; empty hides the pickers                    |
| `readId`         | `string \| null`               | The selected read (`history.selectedId`)                     |
| `overlayId`      | `string \| null`               | The overlay read                                             |
| `onRead`         | `(id: string) => void`         | Selecting a read here selects it page-wide                   |
| `onOverlay`      | `(id: string \| null) => void` | Overlay is Calibration only, apart from the Compare A/B pair |

## Behaviour

- Order: `CalibrationReadPicker`, `EvidenceNotice`, facts line, `CalibrationChartGrid` of `CalibrationChartCard`s, **Show password** (only when a table cell is sensitive), one `DebugSection` with a `ValueTable` per table (a table with `folded` starts collapsed), `UnusedRanges`, `HexDump` (folded).
- No archive: "Open or read a capture". A view that is not `ok`: its reason in an alert. An overlay that is not `ok`: "Overlay not shown" with its reason, and the read is drawn alone.
- Charts and tables pair with the overlay by `id`.
- **Show password** resets when another read or archive is shown (`archiveKey`).
- Wrapped in `DesignSystemV2Provider` as `SettingsTab` is; the page itself stays on the existing theme.
- Display only: no write, reset or capture control.

## Related

- [SettingsTab.md](./SettingsTab.md), [RadioDebugPage.md](./RadioDebugPage.md)
- [CalibrationReadPicker](../../../components/debug/CalibrationReadPicker.md), [CalibrationChartCard](../../../components/debug/CalibrationChartCard.md)
- AT-D890UV view: `src/integrations/radio-io/radios/at-d890uv/debugCalibrationView.ts`
- RT95 view: `src/integrations/radio-io/radios/rt95/debugCalibrationView.ts`
