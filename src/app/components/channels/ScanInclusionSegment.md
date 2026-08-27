# ScanInclusionSegment

## Purpose

Tri-state channel scan control for library CRUD — **Skip scan**, **Default**, and **Always scan** (left to right). Wraps `GradientSegmentedControl` with the `three` colour scheme.

## Props

| Prop       | Type                      | Description                                                                   |
| ---------- | ------------------------- | ----------------------------------------------------------------------------- |
| `value`    | `ScanInclusion`           | Current library field value                                                   |
| `onChange` | `(scanInclusion) => void` | Selection handler                                                             |
| `compact`  | `boolean`                 | Table-row layout — omits label/description, forces `layout='stack'`           |
| `disabled` | `boolean`                 | Optional                                                                      |
| `layout`   | `'stack' \| 'row' \| 'column'` | Forwarded to `GradientSegmentedControl` when not `compact`. Default `'stack'` |

## Usage

```tsx
import ScanInclusionSegment from '@app/components/channels/ScanInclusionSegment.tsx';

<ScanInclusionSegment value={scanInclusion} onChange={setScanInclusion} />;
```

## Behaviour

- **Default** — uses the scan setting on export.
- **Skip scan** — this channel is not scanned.
- **Always scan** — this channel is always scanned.

## Related

- [scan-inclusion reference](../../../../docs/reference/scan-inclusion.md)
- [library feature hub](../../../../docs/features/library/README.md)
- [GradientSegmentedControl](../ui/GradientSegmentedControl.md)
