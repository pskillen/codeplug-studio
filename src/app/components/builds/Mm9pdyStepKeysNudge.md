# Mm9pdyStepKeysNudge

## Purpose

On the AT-D890UV MM9PDY target, after a settings read, offers "Use MM9PDY step keys" when the radio's P1 / P2 short-press keys aren't TG next / TG previous. The button sets two ordinary session overrides (`keyShortP1` = TG next, `keyShortP2` = TG previous); the user can change them like any other setting. Reused by the Write Review step when it lands.

A different key layout is a valid choice, so the component shows **nothing** when the keys already match: no tick, no "all good". It also shows nothing on the stock target, before a read, and once the session overrides either key.

## Props

| Prop         | Type                  | Notes                                              |
| ------------ | --------------------- | -------------------------------------------------- |
| `target`     | `'stock' \| 'mm9pdy'` | Anything but `mm9pdy` renders nothing              |
| `hasRead`    | `boolean`             | False renders nothing                              |
| `readP1`     | `number \| undefined` | P1 short-press function the read found             |
| `readP2`     | `number \| undefined` | P2 short-press function the read found             |
| `overrideP1` | `unknown`             | The session override for P1, when set              |
| `overrideP2` | `unknown`             | The session override for P2, when set              |
| `onUse`      | `() => void`          | Sets the two overrides (the caller owns the store) |

## Usage

```tsx
<Mm9pdyStepKeysNudge
  target={target}
  hasRead={read !== undefined}
  readP1={p1}
  readP2={p2}
  overrideP1={overrides.get('keyShortP1')}
  overrideP2={overrides.get('keyShortP2')}
  onUse={() => mm9pdyStepKeyOverrides().forEach((o) => setOverride(buildId, o.fieldId, o.value))}
/>
```

## Behaviour

- The function numbers come from the radio-io module (`MM9PDY_TG_NEXT_FUNCTION`, `MM9PDY_TG_PREVIOUS_FUNCTION`); the component holds no wire values.
- Any override of P1 or P2 hides the nudge, including the ones "Copy all from this radio" sets: after Copy all the keys equal what the radio has, so the nudge stays quiet even though the user never chose a layout. A caller that wants to ask again (the Write review) must decide that itself.
- There is no link to the build's old persisted step-key switch; the switch is removed from the D890 Write in a later step.

## Related

- [AtD890RadioSettingsEditor](./AtD890RadioSettingsEditor.md)
- [AT-D890UV radio settings](../../../../docs/features/radio-read-write/at-d890uv-radio-settings.md)
