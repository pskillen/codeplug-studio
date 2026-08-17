## Purpose

Read-state severity marker for a wire-preview row, driven by `resolveWireNames`'
`remediation` field (`'none' | 'shortened' | 'disambiguated' | 'truncated' | 'over_limit'`) —
not a `nameTruncated` boolean. Clean shortening and disambiguation stay quiet (dimmed `≈`);
only `truncated`/`over_limit` — genuine information loss the operator didn't control — get the
orange `IconAlertTriangle`. Fixes the satellite keps over-severity the wire-preview rework
brainstorm flagged (today's triangle fired on any shorten).

**Tracking:** [#1217](https://github.com/pskillen/codeplug-studio/issues/1217)

## Props

| Prop           | Type                         | Description                                            |
| -------------- | ---------------------------- | ------------------------------------------------------ |
| `remediation`  | `WireNameRemediation` (opt.) | Renders nothing for `undefined`/`'none'`               |
| `originalName` | `string` (optional)          | Library/original name shown in the `shortened` tooltip |
| `limit`        | `number` (optional)          | Export name length limit shown in tooltips             |

## Usage

```tsx
<WireNameRemediationMarker
  remediation={row.remediation}
  originalName={row.displayLabel}
  limit={nameLimit}
/>
```

## Behaviour

| `remediation`   | Marker                     | Tooltip                                                                    |
| --------------- | -------------------------- | -------------------------------------------------------------------------- |
| `none`          | nothing                    | —                                                                          |
| `shortened`     | dimmed `≈`                 | "Shortened from _Original name_ to fit N characters."                      |
| `disambiguated` | dimmed `≈`                 | "Another item wanted this name, so this one uses the exported name shown." |
| `truncated`     | orange `IconAlertTriangle` | "Cut to N characters. Change the name to control what's kept."             |
| `over_limit`    | orange `IconAlertTriangle` | "Still longer than N characters. The radio will cut it."                   |

Satellite keps has no resolver `remediation` (fixed-width radio field, own shortener) — see
`src/app/lib/satelliteWireNameRemediation.ts` for the `nameTruncated` → `remediation` mapping
it feeds into this component.

## Related

- [wire-preview.md](../../../../docs/features/builds/wire-preview.md)
- [WireNameInlineEditor.md](./WireNameInlineEditor.md)
- `src/core/services/resolveWireNames.ts` — `WireNameRemediation`, `classifyWireNameRemediation`
