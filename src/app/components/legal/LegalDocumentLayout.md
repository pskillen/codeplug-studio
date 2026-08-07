# LegalDocumentLayout

## Purpose

U6 body-text-only legal page shell — back link, title, optional last-updated line, and prose body. No `ListPage` / `Panel` chrome.

## Props

| Prop          | Type        | Description                              |
| ------------- | ----------- | ---------------------------------------- |
| `title`       | `string`    | Document title (page `h1`)               |
| `lastUpdated` | `string`    | Optional human date under the title      |
| `backTo`      | `string`    | Router path for back link (default Help) |
| `backLabel`   | `string`    | Back link text                           |
| `children`    | `ReactNode` | Prose body                               |

## Related

- [app-shell](../../../../docs/features/app-shell/README.md) — legal routes
- [analytics](../../../../docs/features/analytics/README.md) — cookies / consent
