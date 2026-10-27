# AtD890ReviewSections

## Purpose

The AT-D890UV's part of the Write stepper's Review step (#1393): the frequency range, the receive-only channel warning, Radio settings (now → after, with the fleet choice), the backup nudge and the MM9PDY step-key nudge. `registerAtD890Review.tsx` registers them for the D890 descriptor (both targets) through `registerReviewSectionProvider`.

## Props

The components take an `AtD890ReviewController` (`atD890ReviewController.ts`): a small external store created once per Review by `useRadioWriteFlow`.

| Field        | Meaning                                                                                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init`       | Fixed facts: serial, radio-ID name, range, receive-only channels, snapshot, target, whether the settings were read from this radio, whether "don't ask again" is set, and the button actions |
| `getState()` | `{ choice: 'apply' \| 'keep', backup, settingsTicked }`, live                                                                                                                                |
| `canWrite()` | False for Radio settings alone with Keep (Write would send nothing), or while a Language the radio's region forbids would be applied (`blockReason()`)                                       |

## Usage

```tsx
const controller = createAtD890ReviewController({ buildId, serial, range, receiveOnly, ... });
reviewSectionsFor(descriptor, { ...ctx, atD890: controller });
```

## Behaviour

- **Range and channels:** `atD890ReviewFacts.ts` (pure). The range comes from the ident's band code via `describeAtD890FrequencyRange`; receive-only channels are exactly `listAtD890ReceiveOnlyChannels(channels, bandCode)`. They are written anyway.
- **Radio settings:** hidden unless ticked. Same radio as the settings read: the changes, no choice. Another radio (or no read): Apply / Keep its settings (Keep preselected, Apply when "don't ask again" is set) and **Review its settings**.
- **Language guard:** with Radio settings ticked and Apply chosen, a Language override the radio's lock forbids shows a red line and **Clear the language change**; Write stays off until it is cleared or Keep is chosen. The power-on password shows as one change.
- **NXDN ID:** `AtD890NxdnOwnIdNote`, a channel note: "NXDN ID → Base (1234), your default NXDN ID" when the Write sets the radio's NXDN ID (MM9PDY, NXDN enabled, a default NXDN Digital ID; [#1442](https://github.com/pskillen/codeplug-studio/issues/1442)). Hidden for a settings-only Write.
- **Backup:** "Save backup now" from the read the Write holds, or "Read the rest of the radio and save a backup" after a settings-only read; "✓ Backup saved 14:02" afterwards.
- **Nudge:** `Mm9pdyStepKeysNudge`, which hides itself on the stock target, when the keys already match, and once the session overrides either key. Its button also selects Apply, so the Write button's label (`review.effectiveParts`: settings only when they will be sent) and the write agree.

## Related

- [reviewSections](../reviewSections.md), [RadioWriteStepper](../RadioWriteStepper.md)
- [AT-D890UV radio settings](../../../../../../docs/features/radio-read-write/at-d890uv-radio-settings.md)
