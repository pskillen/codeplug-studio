# Uv5rMiniSettings

## Purpose

Read-only UV-5R Mini Settings tab: the settings frame (`0x9000-0x903F`) and VFO frame (`0x8000-0x803F`) decoded from the open debug archive's decoded clone region (`regions.clone`). It never reads a radio. The Mini has no password fields, so nothing is masked.

## Props

| Prop      | Meaning                  |
| --------- | ------------------------ |
| `archive` | The open `DebugArchive`. |

## Usage

The Mini descriptor's `Settings`, mounted as the page-level Settings tab after Memory. Without an archive it shows a No capture alert; an archive without a whole 0x10000-byte clone shows "not captured". The tables are `Uv5rMiniSettingsFrames`, shared with the old `/debug/uv5r-mini` page (`Uv5rMiniSettingsSection`).

## Related

[Uv5rMiniMemory](Uv5rMiniMemory.tsx), [RadioDebugPage](RadioDebugPage.md)
