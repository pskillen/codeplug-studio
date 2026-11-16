# SensitiveRevealButton and useSensitiveReveal

## Purpose

The one **Show password** / **Hide password** control for debug pages, and the hook that holds its state. Password bytes stay masked (`••`) until the person presses the button; the archive keeps every byte, masking is display only.

## Props

- `SensitiveRevealButton`: `revealed: boolean`, `onToggle: () => void`. Renders a default-variant `xs` button with `aria-pressed`.
- `useSensitiveReveal(key?: number)`: returns `{ revealed, toggle }`. `key` is any stable per-source number (the debug pages pass `archiveKey(archive)`); `undefined` means nothing is shown.

## Usage

```tsx
const reveal = useSensitiveReveal(archive ? archiveKey(archive) : undefined);
<SensitiveRevealButton revealed={reveal.revealed} onToggle={reveal.toggle} />;
```

`SettingsTable` draws the button itself when a row is sensitive; pass it `revealed` and `onToggleReveal` from the page's hook.

## Behaviour

- Hidden by default.
- Hidden again whenever `key` changes (new read, import, another retained read).
- No component here knows which bytes are sensitive; each radio's descriptor `sensitiveRanges` hook does.

## Related

- [SettingsTable](SettingsTable.md), [ValueTable](ValueTable.md), [HexDecValue](HexDecValue.md)
