# Alerts

Mantine [`Alert`](https://mantine.dev/core/alert/) primitives for inline status and validation feedback. No wrapper component — import directly from `@mantine/core`.

**Live demos:** `/#/styleguide` → **Alerts** section (ported from codeplug-tool).

## Colour conventions

| Colour   | Use                                               | Examples                                                                                |
| -------- | ------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `blue`   | Informational context, neutral guidance           | Channel editor hints, debug YAML copy notice                                            |
| `yellow` | Warning — operator can continue but should notice | Missing map token, browser-local data notice, RX list already in sync with BrandMeister |
| `red`    | Error — action failed or input invalid            | API fetch failure, validation errors, apply failures                                    |
| `green`  | Success confirmation                              | Repeater channel added, no dangling references on summary                               |
| `gray`   | Empty or unavailable state                        | Debug viewers when a key/row is not set                                                 |

Use `variant="light"` when the alert sits inside a dense form and needs less visual weight (`ChannelEditor`, band reference disclaimer).

## Usage

```tsx
import { Alert } from '@mantine/core';

<Alert color="yellow">RX group list already matches BrandMeister.</Alert>
<Alert color="red">{errorMessage}</Alert>
<Alert color="blue" variant="light" title="Hint">
  Optional titled body for longer copy.
</Alert>
```

## Related

- [`StyleguidePage.tsx`](../../../src/app/routes/StyleguidePage.tsx)
- [`app-shell/README.md`](README.md)
