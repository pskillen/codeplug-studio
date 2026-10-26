# reviewSections

## Purpose

What the Write stepper's Review step shows (#1393). `reviewSectionsFor(descriptor, ctx)` returns the generic sections every radio gets, then sections from per-radio providers, then the time estimate. Radios without settings or range support get identity, channels and time only.

## Props

`reviewSectionsFor(descriptor, ctx: ReviewContext)`; `ReviewContext` is `{ identity, parts, channelCount, contactsNote, kepsCount, estimateSeconds, identityOnly, restartsAfterWrite }`.

## Usage

```tsx
registerReviewSectionProvider({
  matches: (d) => d.modelIds.includes('AT-D890UV'),
  sections: (ctx) => [<RangeSection key="range" … />],
});
```

## Behaviour

- Generic sections: **This radio** (model, name and firmware where known, full serial), **Channels** ("N channels will be written." when the codeplug is ticked), contacts and keps counts when ticked, **Time**.
- `identityOnly`: radios whose read happens inside `upload()` show the ident only and say "Studio reads the rest of the radio while writing."
- The estimate is the write plan's total weight over the throughput measured during the read (`writeEstimate.ts`), never slower than the radio's `nominalBytesPerSecond` (descriptor; default 16 kB/s, AT-D890UV 100 kB/s). The measured rate runs low because read-plan weights are nominal.
- Providers register once at module load; the D890's Review sections (range, receive-only channels, settings, backup) register here in a later PR.

## Related

- [`RadioWriteStepper`](./RadioWriteStepper.md)
- [radio-read-write hub](../../../../../docs/features/radio-read-write/README.md)
