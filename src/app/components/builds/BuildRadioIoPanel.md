# BuildRadioIoPanel

## Purpose

Build Export chrome for **Web Serial** read/write when a registered radio adapter matches the FormatBuild profile. Read hydrates `cpsWireHydration` (`radio-clone`); write runs `assemble` → encode → upload.

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `build` | `FormatBuild` | Active format build (must have a compatible registry descriptor) |

## Usage

```tsx
<BuildRadioIoPanel build={build} />
```

Renders nothing when `descriptorsForBuild(build)` is empty.

## Behaviour

- Feature-detects Web Serial; shows unsupported banner when missing.
- **Read from radio** → download → persist hydration on the build → read-only summary.
- **Write to radio** → blocked until hydration exists (full-image strategy).
- Progress + Cancel via `AbortSignal`.
- In-flow attribution from `descriptor.attributionIds`.

Does **not** import radio channels into the library.

## Related

- [radio-read-write hub](../../../docs/features/radio-read-write/README.md)
- [adding-a-radio-adapter.md](../../../docs/features/radio-read-write/adding-a-radio-adapter.md)
- Services: `src/app/services/radioIoSession.ts`
