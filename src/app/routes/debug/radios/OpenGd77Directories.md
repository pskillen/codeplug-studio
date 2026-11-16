# OpenGd77Directories

## Purpose

Read-only Contacts, RX groups and User Database panels for the OpenGD77 (DM-1701, MD-9600) Memory tab, decoded from the open debug archive without a project, library or build. Nothing is imported, exported or persisted, and no transport is opened.

## Props

| Panel               | Prop      | Meaning                                                              |
| ------------------- | --------- | -------------------------------------------------------------------- |
| `ContactsPanel`     | `archive` | The open archive (`OpenGd77MemoryArchive`, a `DebugArchive` fits).   |
| `RxGroupsPanel`     | `archive` | As above.                                                            |
| `UserDatabasePanel` | `archive` | As above. Holds its own page, search mode, query and applied search. |

## Usage

Mounted by `OpenGd77Memory` in its Contacts, RX groups and User Database tabs (`keepMounted={false}`). `OpenGd77Memory` is keyed by the selected read, so replacing the archive resets rows, page, query and selection.

## Behaviour

Projections are in `integrations/radio-io/radios/opengd77/debugDirectories.ts`. Contacts and RX groups list only when their whole bank was captured, otherwise one "Not captured" alert (never zero rows); both are shared `MemoryCategoryPanel`s (count sentence, caveat, search, temporary sorting, default slot order, click a list for its members; sentences in `opengd77/debugMemoryText.ts`). The User Database table sits in a panel too, with its own opt-in submitted search above it and a page-only filter box in the panel. Contacts show an unknown call type as "Unknown (n)" and the raw time-slot byte. Selecting an RX group shows "n of m members resolved" and each unresolved member with its reason ("contact bank not captured" or "contact slot is empty"). The User Database panel shows Not captured, Refused (with reason), Invalid header (reason and raw header hex, no entries) or a header card (mode byte and its meaning, header count, captured count, segment counts, packed length, a Truncated notice) over a paged table of index, DMR ID, text and true flash address, 100 rows per page with Previous and Next and "Page n of m". Search is submitted (ID prefix or text), stops at 200 results and says "Showing the first 200 matches" when capped. Only one page of rows is ever rendered; records are decoded on demand. Text is 6-bit packed and trimmed; characters outside the alphabet read as spaces.

## Related

[OpenGd77Memory](OpenGd77Memory.md), [Radio debug](../../../../../docs/features/radio-debug/README.md), [debug-memory.md](../../../../../docs/reference/radios/opengd77/debug-memory.md), [user-database.md](../../../../../docs/reference/radios/opengd77/user-database.md)
