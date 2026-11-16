# Debug pages styleguide

How the radio debug pages are built. They have their own kit, apart from the product list kit, because they show raw bytes, uncertain decodes and second reads side by side.

**Interactive demo:** `/styleguide/debug` (synthetic data for a made-up radio; **Overlay** and **Raw bytes** toggles). **Feature hub:** [radio debug](../../features/radio-debug/README.md). **Tracking:** [#1692](https://github.com/pskillen/codeplug-studio/issues/1692), [#1822](https://github.com/pskillen/codeplug-studio/issues/1822).

## Scope

`/debug/radios/*` tabs (Calibration, Settings, Memory, Hex, Compare) and any future debug viewer. Product UI (library, builds) keeps the list kit; debug pages use the kit in `src/app/components/debug/`.

The kit is **dark only**. It draws on design-system v2 tokens and must render inside `DesignSystemV2Provider`; there is no light theme and no light claim anywhere in it.

## Rules

- **Sections.** Every block is a `DebugSection`. No bare `Card withBorder` with a `Title`, and no v1 `PageSection`, on a debug tab.
- **Calibration order.** `CalibrationReadPicker`, then one `EvidenceNotice`, then the chart grid, then value tables, then unused ranges and raw bytes (folded).
- **Charts.** Every chart sits in a `CalibrationChartCard`: a visible title, axis titles with units, a one-line meaning, **About this chart** for the rest, and **Numeric table** for the numbers. Frequency on x is always **MHz, never an index**; the index lives in the Numeric table.
- **Colour slot by meaning.** A series takes its colour from what it is (Low slot 0, Mid 1, High 2, Turbo 3; main 0, sub 1), never from its rank among the series. The overlay is the same slot, dashed on lines and outlined on bars.
- **A card only when the radio has the data.** No empty placeholder cards.
- **Number format.** Write numbers the way the owner reads them:
  - `0x1A (26)` (hex and decimal together) only for **raw bytes, enums and codes**.
  - **Plain decimal with its unit** for counts, frequencies and physical values (`128 channels`, `12800 kHz`).
  - **Hex alone** for addresses (`0x1050`).
  - `HexDecValue`, and the `format` field of the view models, carry this; pick per field.
- **Not captured.** Say it in words: "Not captured". Never zero, empty or a default.
- **Confidence.** `ConfidenceBadge`'s five words. "unused (no reader)" is not "unknown".
- **Passwords** are masked (`••`) until **Show password**, and masked again when the archive changes. The archive keeps every byte; masking is display only.
- **Serial numbers** are shown in full: no masking, no trailing slice, no ellipsis before a serial.
- **Channel identity** is callsign first, then name; the name alone when there is no callsign.
- **Tables** are striped and keep one set of column widths per tab.
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

## Gold references

- **DM-32 Settings and Memory**: the shape every Settings and Memory view follows.
- **RT95 Calibration** (once its page lands on the kit): the shape every Calibration view follows.

## Related

- [UI interaction styleguide](README.md), [display conventions](display.md)
- [Radio debug hub](../../features/radio-debug/README.md)
