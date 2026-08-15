# PowerLadderHints

Contributor sidecar for `PowerLadderHints.tsx` — informational power → watts cheat sheet on channel edit.

## Purpose

Shows how the current library `Channel.power` percent (or `null` radio default) maps to approximate watts and/or CPS wire labels across **configured export profiles**. Does not write vendor data onto the channel.

## Props

| Prop    | Type             | Description                                   |
| ------- | ---------------- | --------------------------------------------- |
| `power` | `number \| null` | Live channel power percent from the edit form |

## Usage

```tsx
<PercentLevelSlider label="Power" value={power} onChange={setPower} />
<PowerLadderHints power={power} />
```

On the channel editor ([#1209](https://github.com/pskillen/codeplug-studio/issues/1209)) the parent lays this out beside the slider on desktop and inside a collapsed **Power examples** disclosure on mobile. This component itself is layout-agnostic.

## Behaviour

- Profile list: unique `(formatId, profileId)` from project format builds; if none, all shipped profiles with a power ladder (`listPowerLadderHints`).
- OpenGD77 `null` → `Master` / radio default (not P9).
- DM32 shows wire labels only when watts metadata is absent.
- Informational only — no `onChange`, no validation, no export changes.

## Related

- [library/README.md](../../../docs/features/library/README.md)
- `#414` — approximate watts from export profiles
- Core: `src/core/import-export/powerLadderHints.ts`
