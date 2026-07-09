# UseLibraryAbbreviationsSwitch

Build export setting: when **Shorten long names** is enabled, prefer `Channel.abbreviation` and `TalkGroup.abbreviation` from the library before dictionary shortening rules.

Patches both `useChannelAbbreviation` and `useTalkGroupAbbreviation` on the build so all CPS formats honour the same toggle.

Used on the export panel, CHIRP flat-memory channels page, and channel wire-preview page.
