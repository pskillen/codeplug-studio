# NextPassCard

## Purpose

Highlighted "next pass" summary card for a single satellite — AOS/LOS/max-elevation, static uplink/downlink/tone/mode, and Doppler-corrected uplink/downlink shown alongside the static values while the pass is active. Modeled on [`BuildListCard`](../builds/BuildListCard.tsx) ("Export for radio — build card" pattern) as a sibling card, not a reuse of it. Used at the top of the satellite detail page (`SatelliteDetailPage.tsx`) and demoed in the [styleguide](/styleguide/v2/patterns).

## Props

| Prop                | Type                 | Notes                                                                                                                                           |
| ------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `satelliteName`     | `string`             | —                                                                                                                                               |
| `nextPass`          | `PassResult \| null` | Earliest upcoming pass, or `null` if none in the current look-ahead window                                                                      |
| `nowMs`             | `number`             | Caller-supplied clock tick (e.g. `useNowTick`) — keeps the card a pure function of props                                                        |
| `hasObserver`       | `boolean`            | Distinguishes "no observer configured" from "observer set, but no pass in this window"                                                          |
| `uplinkHz`          | `number \| null`     | Static, from `Satellite.uplinkHz`                                                                                                               |
| `downlinkHz`        | `number \| null`     | Static, from `Satellite.downlinkHz`                                                                                                             |
| `uplinkToneHz`      | `number \| null`     | Static, from `Satellite.uplinkToneHz`                                                                                                           |
| `downlinkToneHz`    | `number \| null`     | Static, from `Satellite.downlinkToneHz`                                                                                                         |
| `mode`              | `string \| null`     | Best-effort, sourced from SatNOGS enrichment (`SatelliteEnrichment.transmitters[].mode`) — **not** a persisted `Satellite` field, see Behaviour |
| `dopplerUplinkHz`   | `number \| null`     | Doppler-corrected uplink — rendered only while the pass is active                                                                               |
| `dopplerDownlinkHz` | `number \| null`     | Doppler-corrected downlink — rendered only while the pass is active                                                                             |

## Usage

```tsx
import NextPassCard from '../../components/NextPassCard/NextPassCard.tsx';

<NextPassCard
  satelliteName={satellite.name}
  nextPass={future.passes[0] ?? null}
  nowMs={nowMs}
  hasObserver={future.hasObserver}
  uplinkHz={satellite.uplinkHz}
  downlinkHz={satellite.downlinkHz}
  uplinkToneHz={satellite.uplinkToneHz}
  downlinkToneHz={satellite.downlinkToneHz}
  mode={mode}
  dopplerUplinkHz={doppler.uplinkHz}
  dopplerDownlinkHz={doppler.downlinkHz}
/>;
```

## Behaviour

- **Active/above-horizon state:** computed internally via `isPassActive(nowMs, nextPass.aosAt, nextPass.losAt)` (`src/app/routes/tracking/passTime.ts`) — the same helper `PassGrid.tsx`/`SatellitePassList.tsx` use for row highlighting, so "above horizon" means the same thing everywhere in this feature area. When active, the card gets a persistent accent border/tint (the same `color-mix` treatment `DataTable.module.css`'s `.rowActive` uses for live in-progress rows) and an "Above horizon" badge.
- **Countdown:** `formatNextPassCountdown` (`passTime.ts`) — `AOS mm:ss` before the pass, `LOS mm:ss` while active.
- **No persisted `mode` field:** `Satellite` has no `mode` field — the `mode` prop is expected to be sourced from session-scoped SatNOGS enrichment (first `alive` transmitter, falling back to the first transmitter) by the caller, not a real per-satellite setting. Renders `—` when absent.
- **Doppler shading:** `dopplerUplinkHz`/`dopplerDownlinkHz` render only when the pass is active _and_ the caller supplies a non-null value — a small accent-tinted chip beneath the static frequency, visually distinguishing the live-corrected value from the static one rather than replacing it.
- **Empty states:** distinct messages for "no observer location configured" vs. "observer configured, but no pass in the current look-ahead window" — never renders a blank card.

## Related

- [Satellite tracking feature hub](../../../../docs/features/satellite-tracking/README.md)
- [`BuildListCard`](../builds/BuildListCard.tsx) — the card pattern this is modeled on
- [`dopplerShift.ts`](../../../core/domain/satelliteTracking/dopplerShift.ts) — pure Doppler-factor computation, applied by the caller before passing `dopplerUplinkHz`/`dopplerDownlinkHz`
- [`passTime.ts`](../../routes/tracking/passTime.ts) — shared `isPassActive`/`formatNextPassCountdown` helpers
- [`SatelliteDetailPage.tsx`](../../routes/tracking/SatelliteDetailPage.tsx) — wires this card with live data
