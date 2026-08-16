# LibraryAbbreviationsFields

## Purpose

One labelled presentation for the `useChannelAbbreviation` / `useTalkGroupAbbreviation`
build export settings — "one name per setting": the two stored fields stay separate, but
they are shown together under one **Use abbreviations from library** group instead of
scattered across format-specific cards.

## Props

| Prop                       | Type                           | Description                                           |
| -------------------------- | ------------------------------ | ----------------------------------------------------- |
| `shortenNames`             | `boolean`                      | Fallback disabled state when `disabled` is not passed |
| `useChannelAbbreviation`   | `boolean`                      | Channel-kind stored value                             |
| `useTalkGroupAbbreviation` | `boolean`                      | Talk-group-kind stored value                          |
| `onChangeChannel`          | `(value: boolean) => void`     | Patches `useChannelAbbreviation`                      |
| `onChangeTalkGroup`        | `(value: boolean) => void`     | Patches `useTalkGroupAbbreviation`                    |
| `disabled`                 | `boolean` (opt.)               | Overrides the `!shortenNames` default disable         |
| `showChannel`              | `boolean` (opt., default true) | Show the channel-kind switch                          |
| `showTalkGroup`            | `boolean` (opt., default true) | Show the talk-group-kind switch                       |

## Behaviour

- When both kinds are shown, each gets its own switch under a **Use abbreviations from
  library** subheading (`Channel abbreviations` / `Talk group abbreviations`).
- When only one kind is shown (e.g. the channel-only entity card on
  `BuildEntityExportSettingsCard`), the subheading is omitted and the single switch reads
  **Use abbreviations from library** — same label the collapsed pre-unification switch used.
- Replaces `UseLibraryAbbreviationsSwitch`, which collapsed both stored fields into one
  UI boolean (`useChannelAbbreviation && useTalkGroupAbbreviation`) and always wrote both
  together — that collapsed storage from the UI's point of view even though the two
  fields could differ. This component keeps them independently visible and settable
  wherever both kinds are relevant.

## Related

- [ExportBuildSettingsSections.md](./ExportBuildSettingsSections.md) — Naming section
- [BuildEntityExportSettingsCard.md](./BuildEntityExportSettingsCard.md)
