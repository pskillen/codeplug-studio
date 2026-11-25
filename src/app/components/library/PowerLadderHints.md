# PowerLadderHints

Contributor sidecar for `PowerLadderHints.tsx` — informational power → watts cheat sheet on channel edit.

## Purpose

Shows how the current library `Channel.power` selection maps to approximate watts and power labels across configured file and direct-radio profiles.

## Props

| Prop    | Type             | Description                                                                                      |
| ------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| `power` | `number \| null` | Live power selection from the edit form, including 101 for Above High and null for radio default |

## Usage

```tsx
<PowerLadderHints power={power} />
```

On the channel editor ([#1209](https://github.com/pskillen/codeplug-studio/issues/1209)) the parent lays this out beside the slider on desktop and inside a collapsed **Power examples** disclosure on mobile. This component itself is layout-agnostic.

## Behaviour

- Shows one hint per supported profile drawn from the project's build targets. With no builds, it shows the shipped file-profile hints.
- The AT-D890UV example shows High at 100, Turbo at 101, and High marked as radio default for null. The MM9PDY AT-D890UV direct profile has its own hint and uses the same mapping. See the [AT-D890UV power reference](../../../../docs/reference/radios/anytone/at-d890uv/power.md).
- OpenGD77 shows **Master** for radio default.
- DM32 shows wire labels only when watts metadata is absent.
- Informational only — no `onChange`, no validation, no export changes.

## Related

- [Library channel power](../../../../docs/features/library/README.md#channel-power)
- `#414` — approximate watts from export profiles
- Core: `src/core/import-export/powerLadderHints.ts`
