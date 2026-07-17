# IncludeInZoneDerivedScanListSegment

Tri-state (or two-state) control for zone-derived scan list membership.

## Purpose

Edits `IncludeInZoneDerivedScanListOverride` on zone members, or the library boolean default (via `includeDefault={false}` mapping include/skip).

## Props

| Prop             | Type                             | Description                                                |
| ---------------- | -------------------------------- | ---------------------------------------------------------- |
| `value`          | `default` \| `include` \| `skip` | Current override                                           |
| `onChange`       | `(value) => void`                | Updates                                                    |
| `includeDefault` | `boolean`                        | When false, Default option omitted (library defaults page) |
| `compact`        | `boolean`                        | Row layout                                                 |
| `disabled`       | `boolean`                        | Disable control                                            |

## Related

- [zone-behavioural-defaults](../../../../docs/reference/zone-behavioural-defaults.md) (when shipped)
- [`ZoneMemberEditor`](../library/ZoneMemberEditor.md)
