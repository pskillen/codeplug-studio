# EgressPathwayPills

Mood-coded pathway pills for **New build** radio cards — quick visual hint about how pleasant each export pathway is to use.

## Purpose

On [NewBuildPage](../../routes/builds/NewBuildPage.tsx), each radio lists compatible egress pathways as pills instead of plain `·`-separated text. Tone is product guidance, not a hard block.

## Props

| Component            | Props                         | Role                                      |
| -------------------- | ----------------------------- | ----------------------------------------- |
| `EgressPathwayPills` | `egress: readonly CompatibleEgress[]` | Row of pills for one radio target |
| `EgressPathwayPill`  | `entry: CompatibleEgress`     | Single pill                               |

## Tone map

| `formatId`   | Tone       | Pill treatment                    |
| ------------ | ---------- | --------------------------------- |
| `radio-io`   | happiest   | Teal light + plug-connected       |
| `neonplug`   | neutral    | Gray light + browser              |
| `dm32`       | warning    | Orange outline + caution triangle |
| Other (CSV)  | csv        | Yellow light + CSV file icon      |

## Usage

```tsx
import { EgressPathwayPills } from './EgressPathwayPills.tsx';

<EgressPathwayPills egress={target.compatibleEgress} />;
```

## Related

- [New build hub](../../../docs/features/builds/README.md)
- [radio-read-write hub](../../../docs/features/radio-read-write/README.md)
- [`Dm32PreferNeonPlugAlert.tsx`](Dm32PreferNeonPlugAlert.tsx) — stronger CSV warning on Export
