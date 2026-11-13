# reviewSections

## Purpose

What the Write stepper's Review step shows (#1393). `reviewSectionsFor(descriptor, ctx)` returns the generic sections every radio gets, then sections from per-radio providers, then the time estimate. Radios without settings or range support get identity, channels and time only.

## Props

`reviewSectionsFor(descriptor, ctx: ReviewContext)`; `ReviewContext` is `{ identity, parts, channelCount, contactsNote, kepsCount, estimateSeconds, identityOnly, restartsAfterWrite, atD890?, rt95? }`. A provider can also add rows to the identity block (`identityRows`) and content under the Channels line (`channelNotes`).

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
- Providers register once at module load. The AT-D890's (`d890/registerAtD890Review.tsx`, see [AtD890ReviewSections](./d890/AtD890ReviewSections.md)) adds the frequency range row, the receive-only channel warning, the Radio settings section, the backup section and the step-key nudge.
- **Whether Review appears** ([#1638](https://github.com/pskillen/codeplug-studio/issues/1638)). `reviewPauseReasons(descriptor, ctx)` collects `pauseReasons(ctx)` from the matching providers, once each. Empty means the stepper writes straight after the read without showing Review. The generic sections are facts, so only a provider can ask for the pause, and a provider that shows a warning, a refusal or a choice must give a reason for it: a provider without `pauseReasons` never stops the Write. The reasons:

  | Reason                        | Radio            | When                                                                                       |
  | ----------------------------- | ---------------- | ------------------------------------------------------------------------------------------ |
  | `nothing-to-write`            | AT-D890UV, RT95  | The controller's `canWrite()` is false (settings alone with Keep, or no override left)     |
  | `receive-only-channels`       | AT-D890UV        | Channels outside this radio's transmit range                                               |
  | `master-id-on`                | AT-D890UV        | Master Id is on and channels are written                                                   |
  | `step-keys-nudge`             | AT-D890UV MM9PDY | The nudge would show (P1/P2 not the step keys, no override for them)                       |
  | `settings-blocked`            | AT-D890UV        | A Language override this radio's region forbids                                            |
  | `repeater-mode-caution`       | AT-D890UV        | The repeater-mode advice has a caution                                                     |
  | `settings-choice`             | AT-D890UV, RT95  | Settings ticked, another radio (or nothing read), and on the D890 **Don't ask again** off  |
  | `advanced-settings-no-backup` | RT95             | Apply changes an advanced field (power-on password, remote stun/kill) and no backup exists |
  | `zone-key-nudge`              | RT95 MM9PDY      | Zones are written and no key opens the zone selector                                       |

- `rt95` is `{ settings?, modData? }`. `settings` (both RT95 targets, when radio settings overrides exist) drives the "Radio settings" section. `modData` (RT95 MM9PDY only) carries the zone and description counts once the chip-size check passed; `rt95/registerRt95Review.tsx` shows "Radio memory: 32 KiB, zones and descriptions can be written." and the counts. A failed check never reaches Review.

## Related

- [`RadioWriteStepper`](./RadioWriteStepper.md)
- [radio-read-write hub](../../../../../docs/features/radio-read-write/README.md)
