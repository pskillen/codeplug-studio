# PreflightCard

## Purpose

Shows the connected radio identity and pre-flight checklist rows on the Write dialog **Connect** step, before the pre-write read.

## Props

| Prop        | Type                                  | Description                                                     |
| ----------- | ------------------------------------- | --------------------------------------------------------------- |
| `status`    | `'checking' \| 'passed' \| 'refused'` | Badge and body state                                            |
| `identity?` | `RadioPreflightIdentity`              | Reserved for a future identity header (rows carry values today) |
| `rows`      | `readonly RadioPreflightRow[]`        | Model, serial, firmware, storage, …                             |
| `testId?`   | `string`                              | Root `data-testid` (default `preflight-card`)                   |

## Usage

```tsx
<PreflightCard
  status="passed"
  rows={[{ label: 'Serial', value: 'D890UV2401234567', status: 'ok' }]}
/>
```

## Behaviour

Serial values are shown in full. Row status drives ok / warn / bad tags in the third column.

## Related

- [radio-read-write](../../../docs/features/radio-read-write/README.md)
