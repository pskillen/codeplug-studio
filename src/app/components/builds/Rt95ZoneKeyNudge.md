# Rt95ZoneKeyNudge

## Purpose

One-line info banner in the RT95 MM9PDY Write Review: zones will be written but the build does not set "Put Zone on a P-key". The radio may still have a key on DIR from the CPS, so this is information, not a warning, and it has no button.

## Props

| Prop         | Type      | Notes                                         |
| ------------ | --------- | --------------------------------------------- |
| `zones`      | `number`  | Zones the Write will store; 0 renders nothing |
| `zoneKeySet` | `boolean` | True renders nothing                          |

## Usage

```tsx
<Rt95ZoneKeyNudge zones={ctx.rt95.zones} zoneKeySet={ctx.rt95.zoneKey !== undefined} />
```

## Behaviour

Rendered by `RadioWriteStepper/rt95/registerRt95Review.tsx` only on the MM9PDY target (the stock RT95 Review context carries no `rt95`).

## Related

- [RT95 modded firmware](../../../../docs/features/modded-firmware/README.md)
