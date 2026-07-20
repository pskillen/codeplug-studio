# TalkGroupWireNameExamples

## Purpose

Informational preview of how a talk group name or abbreviation appears on **multi-talkgroup expanded** channel wire names (DM32-style export), with automatic shortening to a typical 16-character limit.

## Props

| Prop           | Type     | Description                                  |
| -------------- | -------- | -------------------------------------------- |
| `name`         | `string` | Talk group display name                      |
| `abbreviation` | `string` | Optional abbreviation (live editor value)    |
| `digitalId`    | `number` | DMR group ID (used in failsafe naming modes) |

## Usage

```tsx
<TalkGroupWireNameExamples name={name} abbreviation={abbreviation} digitalId={digitalId} />
```

## Behaviour

- Renders nothing when `name` is empty.
- Examples use sample callsign `GB7GL` and channel name `Glasgow` via `talkGroupWireNamePreviewExamples` in core.
- Shows composed name and shortened result when they differ.

## Related

- [library README](../../../../docs/features/library/README.md)
- [name-shortening.md](../../../../docs/features/import-export/name-shortening.md)
- [dm32 hub](../../../../docs/features/import-export/dm32/README.md) · epic [#503](https://github.com/pskillen/codeplug-studio/issues/503)
