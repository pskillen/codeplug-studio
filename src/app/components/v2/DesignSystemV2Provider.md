# DesignSystemV2Provider

Nested Mantine provider that scopes design-system v2 tokens to a `.dsv2-scope` subtree.

## Purpose

Isolate v2 theme tokens and `--dsv2-*` CSS variables from the live v1 app shell. Editing the root `theme.ts` would regress every existing screen; this provider nests a second `MantineProvider` so v2 styling only applies inside its wrapper.

## Props

| Prop       | Type        | Notes                            |
| ---------- | ----------- | -------------------------------- |
| `children` | `ReactNode` | Content rendered inside v2 scope |

## Usage

```tsx
import { DesignSystemV2Provider, Button } from '@app/components/v2';

<DesignSystemV2Provider>
  <Button variant="primary">Save</Button>
</DesignSystemV2Provider>;
```

## Behaviour

- Passes `themeV2`, `dsv2CssVariablesResolver`, and `cssVariablesSelector=".dsv2-scope"` to a nested `MantineProvider`.
- Forces dark color scheme (v2 is dark-first).
- Wraps children in `<div className="dsv2-scope">` so injected CSS variables attach to that element, never `:root`.
- Preserves v1 combobox / modal z-index defaults via the merged theme (see `theme-v2.ts`).

## Related

- [theme-v2.ts](../../theme-v2.ts)
- [docs/features/design-system-v2/README.md](../../../../docs/features/design-system-v2/README.md) (hub, added in #916 docs slice)
- Epic [#915](https://github.com/pskillen/codeplug-studio/issues/915) / foundations [#916](https://github.com/pskillen/codeplug-studio/issues/916)
