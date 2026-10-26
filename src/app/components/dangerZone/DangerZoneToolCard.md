# DangerZoneToolCard

## Purpose

One tool on the Danger zone area ([`BuildDangerZonePage`](../../routes/builds/danger-zone/BuildDangerZonePage.tsx)): title, what it does, what it costs, how long it takes, and a single **Start…**. Presentational; the page decides which tools are offered (registry and gate in `services/dangerZone/`).

## Props

| Prop      | Type                                                                                  | Notes                                                                              |
| --------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `tool`    | `Pick<DangerZoneToolDescriptor, 'id' \| 'title' \| 'summary' \| 'cost' \| 'minutes'>` | Copy comes from the registry entry                                                 |
| `onStart` | `() => void`                                                                          | Optional. Absent: no button (a tool with no wizard yet shows its description only) |

## Usage

```tsx
<DangerZoneToolCard tool={tool} onStart={tool.route ? () => navigate(tool.route) : undefined} />
```

## Behaviour

- Body reads "<summary> <cost> About N minutes. You'll save two backup files."
- No danger colour on the card: the area's strap carries it (danger colour once per screen).
- Phone width: the button is full width; from 640 px it hugs the right edge.
- Nothing on the card touches the radio.

## Related

- [danger-zone.md](../../../../docs/features/radio-read-write/danger-zone.md)
