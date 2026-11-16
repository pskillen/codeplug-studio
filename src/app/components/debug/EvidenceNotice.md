# EvidenceNotice

The one "not validated on hardware" notice per debug tab.

## Purpose

Replaces the differently worded alerts per radio. The text comes from an `EvidenceNoticeView` built in the radio's home; the component holds none.

## Props

| Prop     | Type                 | Notes                                                             |
| -------- | -------------------- | ----------------------------------------------------------------- |
| `notice` | `EvidenceNoticeView` | `title`, `lines`, `tone` (`caution` amber, `info` neutral accent) |

## Usage

```tsx
<EvidenceNotice notice={{ title: 'Not validated on hardware', lines: [...], tone: 'caution' }} />
```

## Behaviour

- Shows the first two lines (`EVIDENCE_NOTICE_VISIBLE_LINES`); any more fold behind **More** / **Less** (`aria-expanded`).
- `role="note"`, `data-tone` carries the tone.

## Related

- [DebugSection.md](./DebugSection.md)
- [docs/reference/styleguide/debug-pages.md](../../../../docs/reference/styleguide/debug-pages.md)
