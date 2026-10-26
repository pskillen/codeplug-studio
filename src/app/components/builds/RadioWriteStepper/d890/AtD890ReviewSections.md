# AtD890ReviewSections

## Purpose

The AT-D890UV's part of the Write stepper's Review step (#1393): the frequency range, the receive-only channel warning, Radio settings (now → after, with the fleet choice), the backup nudge and the MM9PDY step-key nudge. `registerAtD890Review.tsx` registers them for the D890 descriptor (both targets) through `registerReviewSectionProvider`.

## Props

The components take an `AtD890ReviewController` (`atD890ReviewController.ts`): a small external store created once per Review by `useRadioWriteFlow`.

| Field        | Meaning                                                                                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init`       | Fixed facts: serial, radio-ID name, range, receive-only channels, snapshot, target, whether the settings were read from this radio, whether "don't ask again" is set, and the button actions |
| `getState()` | `{ choice: 'apply' \| 'keep', backup, settingsTicked }`, live                                                                                                                                |
| `canWrite()` | False for Radio settings alone with Keep (Write would send nothing)                                                                                                                          |

## Usage

```tsx
const controller = createAtD890ReviewController({ buildId, serial, range, receiveOnly, ... });
reviewSectionsFor(descriptor, { ...ctx, atD890: controller });
```

## Behaviour

- **Range and channels:** `atD890ReviewFacts.ts` (pure). The range comes from the ident's band code via `describeAtD890FrequencyRange`; receive-only channels are exactly `listAtD890ReceiveOnlyChannels(channels, bandCode)`. They are written anyway.
- **Radio settings:** hidden unless ticked. Same radio as the settings read: the changes, no choice. Another radio (or no read): Apply / Keep its settings (Keep preselected, Apply when "don't ask again" is set) and **Review its settings**.
- **Backup:** "Save backup now" from the read the Write holds, or "Read the rest of the radio and save a backup" after a settings-only read; "✓ Backup saved 14:02" afterwards.
- **Nudge:** `Mm9pdyStepKeysNudge`, which hides itself on the stock target, when the keys already match, and once the session overrides either key.

## Related

- [reviewSections](../reviewSections.md), [RadioWriteStepper](../RadioWriteStepper.md)
- [AT-D890UV radio settings](../../../../../../docs/features/radio-read-write/at-d890uv-radio-settings.md)
