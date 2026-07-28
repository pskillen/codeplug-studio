# AtD890WriteVerifyReport

Full-memory write verify report shown after an AT-D890UV serial Write.

## Purpose

Displays the outcome of cross-session write verify: staged 16-byte chunk comparison against a post-commit memory dump, plus preserved-settings sentinel status. Mirrors the debug Memory dump region table layout.

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `result` | `AtD890WriteVerifyResult` | Compare outcome from `verifyAtD890WriteMemory` |
| `onClose` | `() => void` | Dismiss report and reset parent verify state |

## Usage

```tsx
{verifyResult ? (
  <AtD890WriteVerifyReport result={verifyResult} onClose={handleCloseVerifyReport} />
) : null}
```

## Behaviour

- Summary alert: pass/fail with chunk and sentinel counts
- Grouped region table (`AT_D890_MEMORY_REGION_GROUPS`) with per-region badges
- Mismatch detail table (first 50 rows) with expected/actual hex
- Preserved-settings sub-table when sentinel compare fails
- **Copy markdown** — `formatAtD890WriteVerifyMarkdown` for issue paste
- **Download JSON** — serializable mismatch export when failures exist

## Related

- [radio-read-write](../../../docs/features/radio-read-write/README.md)
- [AT-D890UV protocol](../../../docs/reference/radios/anytone/at-d890uv/protocol.md)
- [BuildRadioIoPanel](./BuildRadioIoPanel.tsx) — orchestrates verify flow
