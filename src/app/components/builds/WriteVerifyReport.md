# WriteVerifyReport

Cross-session write verify report shown after a Web Serial Write when the radio descriptor supplies `writeVerify` hooks.

## Purpose

Displays staged chunk comparison against a post-commit read-back, optional retained-region (kept) status, grouped region table, mismatch detail, and debug export. Radio-specific region groups and markdown formatting come from the adapter via `WriteVerifyResult.regionGroups` and `formatDebugMarkdown`.

## Props

| Prop                  | Type                          | Description                                                    |
| --------------------- | ----------------------------- | -------------------------------------------------------------- |
| `result`              | `WriteVerifyResult`           | Compare outcome from `verifyRadioWrite`                        |
| `debugContext`        | `WriteVerifyDebugContext`     | Build/egress/session context for debug export                  |
| `formatDebugMarkdown` | `(result, context) => string` | Adapter-owned debug markdown (from `descriptor.writeVerify`)   |
| `onClose`             | `() => void`                  | Dismiss report and reset parent verify state                   |
| `inModal`             | `boolean` (optional)          | Body-only layout when parent supplies Modal chrome             |
| `keptSectionTitle`    | `string` (optional)           | Label for retained-region section (D890: "Preserved settings") |
| `keptSummaryLabel`    | `string` (optional)           | Pass summary suffix (D890: "6 sentinel regions")               |

## Usage

```tsx
{
  verifyResult && descriptor.writeVerify ? (
    <WriteVerifyReport
      result={verifyResult}
      debugContext={debugContext}
      formatDebugMarkdown={descriptor.writeVerify.formatDebugMarkdown}
      onClose={handleCloseVerifyReport}
      keptSectionTitle="Preserved settings"
      keptSummaryLabel="6 sentinel regions"
    />
  ) : null;
}
```

## Behaviour

- Summary alert: pass/fail with chunk and optional kept-region counts
- Grouped region table from `result.regionGroups` with per-region badges
- Mismatch detail table (first 50 rows) with expected/actual hex
- Kept-region sub-table when `result.kept.ok` is false
- **Copy debug info** — adapter `formatDebugMarkdown` (full mismatch list + session context)
- **Download markdown** / **Download JSON** — generic `write-verify-*` filenames

## Related

- [radio-read-write](../../../docs/features/radio-read-write/README.md)
- [BuildRadioIoPanel](./BuildRadioIoPanel.tsx) — orchestrates verify flow
