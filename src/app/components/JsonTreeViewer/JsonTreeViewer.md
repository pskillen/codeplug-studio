# JsonTreeViewer

## Purpose

Read-only collapsible JSON tree for debug and inspection pages. Wraps `@uiw/react-json-view` with expand/collapse controls and a scrollable viewport.

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `value` | `unknown` | Data to display. Non-objects are wrapped as `{ value: data }`. |

## Usage

```tsx
import JsonTreeViewer from '@app/components/JsonTreeViewer/JsonTreeViewer.tsx';

<JsonTreeViewer value={{ id: 'abc', name: 'Local' }} />
```

## Behaviour

- Default collapsed depth: `5` (`JSON_TREE_DEFAULT_COLLAPSED_DEPTH`).
- **Expand all** / **Collapse to default** remount the tree to reset expansion state.
- Max height `70vh` with auto scroll.

## Related

- [Debug feature docs](../../../../docs/features/debug/README.md)
- Issue [#54](https://github.com/pskillen/codeplug-studio/issues/54)
