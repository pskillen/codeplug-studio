# ScanInclusionSegment

## Purpose

Tri-state channel scan control for library CRUD — **Skip scan**, **Default**, and **Always scan** (left to right). Wraps `GradientSegmentedControl` with the `three` colour scheme.

## Props

| Prop       | Type                      | Description                 |
| ---------- | ------------------------- | --------------------------- |
| `value`    | `ScanInclusion`           | Current library field value |
| `onChange` | `(scanInclusion) => void` | Selection handler           |

## Usage

```tsx
import ScanInclusionSegment from '@app/components/channels/ScanInclusionSegment.tsx';

<ScanInclusionSegment value={scanInclusion} onChange={setScanInclusion} />;
```

## Behaviour

- **Default** — resolved at export from `FormatBuild.exportSettings.defaultScanInclusion` and the format adapter default.
- **Skip scan** — always excluded from scan on wire.
- **Always scan** — always included on wire.

## Related

- [scan-inclusion reference](../../../../docs/reference/scan-inclusion.md)
- [library feature hub](../../../../docs/features/library/README.md)
- [GradientSegmentedControl](../ui/GradientSegmentedControl.md)
