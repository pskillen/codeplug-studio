# NextPassCard

## Purpose

Highlighted "next pass" summary card for a single satellite — AOS/LOS/max-elevation, then one block per transmitter with its static uplink/downlink/tone/mode, and Doppler-corrected uplink/downlink shown alongside the static values while the pass is active. Modeled on [`BuildListCard`](../builds/BuildListCard.tsx) ("Export for radio — build card" pattern) as a sibling card, not a reuse of it. Used at the top of the satellite detail page (`SatelliteDetailPage.tsx`) and demoed in the [styleguide](/styleguide/v2/patterns).

## Props

| Prop                     | Type                        | Notes                                                                                                                        |
| ------------------------ | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `satelliteName`          | `string`                    | —                                                                                                                            |
| `nextPass`               | `PassResult \| null`        | Earliest upcoming pass, or `null` if none in the current look-ahead window                                                   |
| `nowMs`                  | `number`                    | Caller-supplied clock tick (e.g. `useNowTick`) — keeps the card a pure function of props                                     |
| `hasObserver`            | `boolean`                   | Distinguishes "no observer configured" from "observer set, but no pass in this window"                                       |
| `transmitters`           | `NextPassCardTransmitter[]` | One entry per `Satellite.transmitters` row to render — empty array renders a "No transmitter data" message instead of a grid |
| `upcomingPassesAnchorId` | `string`                    | When set, renders a mobile-only "Jump to upcoming passes" link pointing at `#<id>` — see Behaviour                           |

### `NextPassCardTransmitter`

| Field               | Type             | Notes                                                                                    |
| ------------------- | ---------------- | ---------------------------------------------------------------------------------------- |
| `id`                | `string`         | React key — matches the source `SatelliteTransmitter.id`                                 |
| `label`             | `string`         | Rendered as the block heading                                                            |
| `mode`              | `string \| null` | Real per-transmitter model field (`SatelliteTransmitter.mode`) — renders `—` when null   |
| `uplinkHz`          | `number \| null` | Static uplink                                                                            |
| `downlinkHz`        | `number \| null` | Static downlink                                                                          |
| `uplinkToneHz`      | `number \| null` | Static CTCSS uplink tone                                                                 |
| `downlinkToneHz`    | `number \| null` | Static CTCSS downlink tone                                                               |
| `dopplerUplinkHz`   | `number \| null` | Doppler-corrected uplink for this transmitter — rendered only while the pass is active   |
| `dopplerDownlinkHz` | `number \| null` | Doppler-corrected downlink for this transmitter — rendered only while the pass is active |

## Usage

```tsx
import NextPassCard from '../../components/NextPassCard/NextPassCard.tsx';

<NextPassCard
  satelliteName={satellite.name}
  nextPass={future.passes[0] ?? null}
  nowMs={nowMs}
  hasObserver={future.hasObserver}
  transmitters={satellite.transmitters
    .filter((t) => !t.dismissed)
    .map((t) => {
      const d = doppler.find((x) => x.id === t.id);
      return {
        id: t.id,
        label: t.label,
        mode: t.mode,
        uplinkHz: t.uplinkHz,
        downlinkHz: t.downlinkHz,
        uplinkToneHz: t.uplinkToneHz,
        downlinkToneHz: t.downlinkToneHz,
        dopplerUplinkHz: d?.uplinkHz ?? null,
        dopplerDownlinkHz: d?.downlinkHz ?? null,
      };
    })}
/>;
```

## Behaviour

- **Active/above-horizon state:** computed internally via `isPassActive(nowMs, nextPass.aosAt, nextPass.losAt)` (`src/app/routes/tracking/passTime.ts`) — the same helper `PassGrid.tsx`/`SatellitePassList.tsx` use for row highlighting, so "above horizon" means the same thing everywhere in this feature area. When active, the card gets a persistent accent border/tint (the same `color-mix` treatment `DataTable.module.css`'s `.rowActive` uses for live in-progress rows) and an "Above horizon" badge.
- **Countdown:** `formatNextPassCountdown` (`passTime.ts`) — `AOS mm:ss` before the pass, `LOS mm:ss` while active.
- **Per-transmitter blocks:** one block per entry in `transmitters`, each with its own label heading and mode/uplink/downlink/tone grid. `mode` is a real persisted `SatelliteTransmitter.mode` field, not a SatNOGS-enrichment workaround — no picking a single "representative" mode across transmitters.
- **No-transmitter state:** when `transmitters` is empty, renders "No transmitter data for this satellite." in place of the transmitter grid — AOS/LOS/max-elevation above it still render normally.
- **Doppler shading:** each transmitter's `dopplerUplinkHz`/`dopplerDownlinkHz` render only when the pass is active _and_ the caller supplies a non-null value for that transmitter — a small accent-tinted chip beneath the static frequency, visually distinguishing the live-corrected value from the static one rather than replacing it.
- **Empty states:** distinct messages for "no observer location configured" vs. "observer configured, but no pass in the current look-ahead window" — never renders a blank card.
- **Jump-to-passes link:** rendered whenever `upcomingPassesAnchorId` is set — independent of the empty/happy-path branch above it, since the target table exists on the page either way. CSS-hidden above the satellite detail page's own 900px stacked-layout breakpoint (`NextPassCard.module.css`), where the table is already close enough not to need it.

## Related

- [Satellite tracking feature hub](../../../../docs/features/satellite-tracking/README.md)
- [`BuildListCard`](../builds/BuildListCard.tsx) — the card pattern this is modeled on
- [`dopplerShift.ts`](../../../core/domain/satelliteTracking/dopplerShift.ts) — pure Doppler-factor computation, applied per transmitter by the caller (`useDopplerShiftedFrequencies`) before passing `dopplerUplinkHz`/`dopplerDownlinkHz`
- [`passTime.ts`](../../routes/tracking/passTime.ts) — shared `isPassActive`/`formatNextPassCountdown` helpers
- [`SatelliteDetailPage.tsx`](../../routes/tracking/SatelliteDetailPage.tsx) — wires this card with live data
