# GettingStartedContent

Reusable getting-started copy and flow for first-run Projects empty state and the voluntary **Quick start** modal.

## Purpose

Explain the library → builds → export path, steer operators to **Add from…** directories and curated sets, outline an optional DMR shortcut, contrast Studio with a typical CPS, and link **Reference** tools — without a forced product tour.

## Props

| Component               | Prop        | Type                  | Notes                    |
| ----------------------- | ----------- | --------------------- | ------------------------ |
| `GettingStartedContent` | _(none)_    | —                     | Self-contained copy      |
| `GettingStartedFlow`    | `steps`     | `{ title, detail }[]` | Numbered accessible list |
| `GettingStartedFlow`    | `ariaLabel` | `string`              | Label for the `<ol>`     |
| `GettingStartedModal`   | `opened`    | `boolean`             | Controlled visibility    |
| `GettingStartedModal`   | `onClose`   | `() => void`          | Dismiss handler          |

## Usage

```tsx
import GettingStartedContent from '../onboarding/GettingStartedContent.tsx';
import GettingStartedModal from '../onboarding/GettingStartedModal.tsx';

// Inline empty state
<GettingStartedContent />

// Voluntary modal
<GettingStartedModal opened={opened} onClose={() => setOpened(false)} />
```

## Behaviour

- Shown **inline** on Home when `projects.length === 0` (after load).
- Same body opens from **Quick start** on Home and Help when the operator chooses it — never auto-forced.
- Flow steps are a semantic ordered list with numbered badges; arrows between steps are decorative (`aria-hidden`).
- Reference links go to `/reference/bands` and `/reference/maidenhead`.

## Related

- [docs/features/onboarding/README.md](../../../../docs/features/onboarding/README.md)
- [repeater-directories](../../../../docs/features/repeater-directories/README.md)
- [help writing styleguide](../../../../docs/reference/writing-styleguide/help-writing-styleguide.md)
