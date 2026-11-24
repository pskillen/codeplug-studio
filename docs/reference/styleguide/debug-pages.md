# Debug pages styleguide

How the radio debug pages are built. They have their own kit, apart from the product list kit, because they show raw bytes, uncertain decodes and second reads side by side.

**Interactive demo:** `/styleguide/debug` (synthetic data for a made-up radio; **Overlay** and **Raw bytes** toggles). **Feature hub:** [radio debug](../../features/radio-debug/README.md).

## Scope

**Firmware colour.** RadioFoundry teal, OpenGD77 orange, stock blue (`DEBUG_FIRMWARE_COLOR`), on the index buttons, the switch, the header chip, the tab underline and read-history markers. No marker on a debug page uses these three colours for another meaning; capability badges stay green, yellow and gray.

`/debug/radios/*` tabs (Calibration, Settings, Memory, Hex, Compare) and any future debug viewer. Product UI (library, builds) keeps the list kit; debug pages use the kit in `src/app/components/debug/`.

The kit is **dark only**. It draws on design-system v2 tokens and must render inside `DesignSystemV2Provider`; there is no light theme and no light claim anywhere in it. The whole `/debug/radios/:radio/:firmware` page (and the legacy `/debug/radios/:radio` redirect) — header, tab bar, every tab body, including the plain Mantine Backup, Hex, Compare and Overview tabs — sits inside one `DesignSystemV2Provider scheme="dark"`, so it is dark throughout even when the app theme is light; tabs and kit components do not wrap themselves. The shell paints `main` and the footer dark for these routes (`isDarkPagePath`), and selects open inside the scope, so no dropdown or strip is light.

## Rules

- **Sections.** Every block is a `DebugSection`. No bare `Card withBorder` with a `Title`, and no v1 `PageSection`, on a debug tab.
- **Calibration order.** `CalibrationReadPicker`, then one `EvidenceNotice`, then the chart grid, then value tables, then unused ranges and raw bytes (folded).
- **Charts.** Every chart sits in a `CalibrationChartCard`: a visible title, axis titles with units, a one-line meaning, **About this chart** for the rest, and **Numeric table** for the numbers. Frequency on x is always **MHz, never an index**; the index lives in the Numeric table. The one exception is OpenGD77 squelch, which has no traced frequency grid and plots against the point index, with the reason stated on the card.
- **Colour slot by meaning.** A series takes its colour from what it is (Low slot 0, Mid 1, High 2, Turbo 3; main 0, sub 1), never from its rank among the series. The overlay is the same slot, dashed on lines and outlined on bars.
- **A card only when the radio has the data.** No empty placeholder cards.
- **Number format.** Write numbers the way the owner reads them:
  - `0x1A (26)` (hex and decimal together) only for **raw bytes, enums and codes**.
  - **Plain decimal with its unit** for counts, frequencies and physical values (`128 channels`, `12800 kHz`).
  - **Hex alone** for addresses (`0x1050`).
  - `HexDecValue`, and the `format` field of the view models, carry this; pick per field.
- **Compare decoded changes.** Compare draws one decoded-changes view for every radio (`compare/DecodedDiffView`, or the flat `DecodedChanges` list). A radio's `compare.decoded(archive)` supplies domains, records and fields; the field's optional `address` shows as an **Address** column in hex alone, only when the record's fields have one. No radio-specific compare view, and no radio slug, address or caveat text in the view: those arrive in the snapshot.
- **Not captured.** Say it in words: "Not captured". Never zero, empty or a default.
- **Confidence.** `ConfidenceBadge`'s five words. In a value table the two pills are labelled Layout and Meaning. "unused (no reader)" is not "unknown".
- **Passwords** are masked (`••`) until **Show password**, and masked again when the archive changes. The archive keeps every byte; masking is display only.
- **Serial numbers** are shown in full: no masking, no trailing slice, no ellipsis before a serial.
- **Channel identity** is callsign first, then name; the name alone when there is no callsign.
- **Tables** are striped on the `--dsv2-surface` token (`--dsv2-surface-quiet` is invisible on the dark page) and keep one set of column widths per tab.
- **No radio literals** in kit components or tab shells. Labels, addresses, units and caveats arrive in the view model a radio home builds (`integrations/radio-io/radios/<radio>/`).
- **Phone.** One column of cards, pickers stacked, wide tables scroll inside their container, secondary columns fold under the label.
- **Read only.** The kit draws; it never adds a write, reset or capture path.

## Component map

All under `src/app/components/debug/`, exported from `index.ts`.

| Component                                                                           | Job                                                                 |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [DebugSection](../../../src/app/components/debug/DebugSection.md)                   | Titled bordered container for every block                           |
| [EvidenceNotice](../../../src/app/components/debug/EvidenceNotice.md)               | The one "not validated on hardware" notice per tab                  |
| [ConfidenceBadge](../../../src/app/components/debug/ConfidenceBadge.md)             | Layout or meaning confidence as a pill                              |
| [HexDecValue](../../../src/app/components/debug/HexDecValue.md)                     | One number in the owner's number format                             |
| [SensitiveRevealButton](../../../src/app/components/debug/SensitiveRevealButton.md) | **Show password** control and its `useSensitiveReveal` hook         |
| [CalibrationTab](../../../src/app/routes/debug/radios/CalibrationTab.md)            | The whole Calibration tab body: pickers, notice, charts, tables     |
| [CalibrationReadPicker](../../../src/app/components/debug/CalibrationReadPicker.md) | Read and optional Overlay selects                                   |
| [CalibrationChartGrid](../../../src/app/components/debug/CalibrationChartGrid.md)   | The grid the chart cards sit in                                     |
| [CalibrationChartCard](../../../src/app/components/debug/CalibrationChartCard.md)   | One chart in its container, by `kind`                               |
| [FrequencyCurveChart](../../../src/app/components/debug/FrequencyCurveChart.md)     | A value per MHz, one line per level                                 |
| [StepBarChart](../../../src/app/components/debug/StepBarChart.md)                   | One bar per step (squelch, S-meter)                                 |
| [BatteryChart](../../../src/app/components/debug/BatteryChart.md)                   | Battery thresholds as a ladder                                      |
| [TrimDisplay](../../../src/app/components/debug/TrimDisplay.md)                     | A trim on its scale, with ppm when known                            |
| [NumericTable](../../../src/app/components/debug/NumericTable.md)                   | The numbers behind a chart, folded                                  |
| [ValueTable](../../../src/app/components/debug/ValueTable.md)                       | Striped named values with decoded text, raw bytes, confidence       |
| [SettingsTable](../../../src/app/components/debug/SettingsTable.md)                 | The whole Settings tab body for one read                            |
| [UnusedRanges](../../../src/app/components/debug/UnusedRanges.md)                   | "Never read" ranges, folded under a count                           |
| [HexDump](../../../src/app/components/debug/HexDump.md)                             | Raw bytes in pages: address, hex, ASCII                             |
| [MemoryCategories](../../../src/app/components/debug/MemoryCategories.md)           | The Category dropdown and the one selected panel                    |
| [MemoryCategoryPanel](../../../src/app/components/debug/MemoryCategoryPanel.md)     | One Memory category: count, caveat, search, sortable table, details |

A Memory view passes `count` for every category that has a decoded list, equal to the panel's own "N results" before any search (a category that is not captured has no count). Zones draw as a zone table, with the member table (callsign then name) opened by clicking a row.

## Gold references

- **DM-32 Settings and Memory**: the shape every Settings and Memory view follows.
- **RT95 Calibration**: the shape every Calibration view follows.

## Related

- [UI interaction styleguide](README.md), [display conventions](display.md)
- [Radio debug hub](../../features/radio-debug/README.md)
