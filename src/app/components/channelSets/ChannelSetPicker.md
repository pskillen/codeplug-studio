# ChannelSetPicker

## Purpose

Library workflow for generating curated channel sets (PMR446, UK V/U FM simplex grids, CB) into the active project with preview, dedup, and optional zone creation.

## Props

| Prop     | Type | Description                                           |
| -------- | ---- | ----------------------------------------------------- |
| _(none)_ | —    | Reads active project and library from app state hooks |

## Usage

```tsx
import ChannelSetPicker from '@app/components/channelSets/ChannelSetPicker.tsx';

<ChannelSetPicker />;
```

Routed at `/library/channels/add-channel-set` via `AddChannelSetPage`.

## Behaviour

- Set selector lists all v1 channel sets with channel counts
- Live preview table: per-channel checkbox (default on), name, frequency (`<MHz> simplex` for simplex rows; RX/TX column reserved for future split channels), mode, dedup status
- Options: name prefix, power %, **bandwidth** (12.5 or 25 kHz), forbid transmit, optional zone
- Persists via `persistChannelSetImport` → `putChannel` loop and optional `putZone`
- Navigates to channels list or new zone on success

## Related

- [Library CRUD](../../../docs/features/library/README.md)
- [Channel sets reference](../../../docs/reference/channel-sets.md)
- Core: `src/core/domain/channelSets/`, `src/core/services/channelSetImport.ts`
