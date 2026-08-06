# DirectoryIngestPage

## Purpose

Shared mk2 Batch 5 page shell for directory search and ingest routes — wraps content in `DesignSystemV2Provider`, `EditorHeader`, and optional sticky footer.

## Props

| Prop       | Type        | Description                                      |
| ---------- | ----------- | ------------------------------------------------ |
| `crumb`    | `string`    | Back link label (e.g. `Channels`)                |
| `crumbTo`  | `string`    | React Router path for the crumb                  |
| `title`    | `string`    | Page title                                       |
| `subtitle` | `ReactNode` | Optional subtitle under the title                |
| `children` | `ReactNode` | Main page body (filters, tables, map, etc.)      |
| `footer`   | `ReactNode` | Optional sticky footer (bulk actions, save bars) |

## Usage

Used by repeater directory search, OpenAIP, RadioID, and channel-set import pages.

## Related

- [EditorHeader](../v2/EditorHeader.md)
- [design-system-v2 Batch 5](../../../docs/features/design-system-v2/design-system-v2-progress.md)
