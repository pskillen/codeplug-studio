# RadioFinder

"What radio have you got?": a chip per catalog model, then a card per firmware variant for the selected model.

## Props

| Prop             | Type                         | Notes                      |
| ---------------- | ---------------------------- | -------------------------- |
| `rows`           | `readonly SupportModelRow[]` | From `buildSupportMatrix`  |
| `onStartProject` | `() => void`                 | CTA on each supported card |

## Usage

```tsx
<RadioFinder rows={rows} onStartProject={openNewProject} />
```

## Behaviour

- Cards list features grouped Program it / Organise / DMR, using `SUPPORT_COLUMNS`, with a `SupportCellMark` each (including † notes on supported feature cells when present).
- RadioFoundry cards show **Checked against** the pinned commit under the header.
- A **Channel modes** section lists every mode column (including not applicable digital modes on FM radios), with evidence tags where recorded.
- Unsupported firmware (for example stock DM-1701) shows "Not supported" and points to the best supported firmware.
- "Most features" marks the top-scoring firmware when more than one is supported.
- Cards with `flash: supported` link to `/firmware`.
- Phones: chips and cards scroll sideways, cards snap.

## Related

[Onboarding hub](../../../../docs/features/onboarding/README.md), [RadioModelPills](../builds/RadioModelPills.md).
