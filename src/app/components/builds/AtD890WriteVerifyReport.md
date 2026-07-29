# AtD890WriteVerifyReport

Full-memory write verify report shown after an AT-D890UV serial Write.

## Purpose

Displays the outcome of cross-session write verify: staged 16-byte chunk comparison against a post-commit memory dump, plus preserved-settings sentinel status. Mirrors the debug Memory dump region table layout.

## Props

| Prop           | Type                            | Description                                        |
| -------------- | ------------------------------- | -------------------------------------------------- |
| `result`       | `AtD890WriteVerifyResult`       | Compare outcome from `verifyAtD890WriteMemory`     |
| `debugContext` | `AtD890WriteVerifyDebugContext` | Build/egress/session context for debug export      |
| `onClose`      | `() => void`                    | Dismiss report and reset parent verify state       |
| `inModal`      | `boolean` (optional)            | Body-only layout when parent supplies Modal chrome |

## Usage

```tsx
{
  verifyResult ? (
    <AtD890WriteVerifyReport
      result={verifyResult}
      debugContext={{
        buildId,
        egressId,
        formatId,
        profileId,
        measuredAt: new Date().toISOString(),
      }}
      onClose={handleCloseVerifyReport}
    />
  ) : null;
}
```

## Behaviour

- Summary alert: pass/fail with chunk and sentinel counts
- Grouped region table (`AT_D890_MEMORY_REGION_GROUPS`) with per-region badges
- Mismatch detail table (first 50 rows) with expected/actual hex
- Preserved-settings sub-table when sentinel compare fails
- **Copy debug info** — inline anchor; `formatAtD890WriteVerifyDebugMarkdown` with full mismatch list, session context, and investigation hints for AI agents
- **Download markdown** — same full debug markdown as a `.md` file
- **Download JSON** — serializable mismatch export when failures exist

## Related

- [radio-read-write](../../../docs/features/radio-read-write/README.md)
- [AT-D890UV protocol](../../../docs/reference/radios/anytone/at-d890uv/protocol.md)
- [BuildRadioIoPanel](./BuildRadioIoPanel.tsx) — orchestrates verify flow
