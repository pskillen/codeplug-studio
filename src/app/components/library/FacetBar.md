# FacetBar / FacetChip / SplitFilter

Page-local filter chrome for library list routes (Batch 2 L2 facets).

## Purpose

Pill chips and a two-way split toggle matching mk2 Batch 2 facet bars. Lives under `library/` until a DS `_ds` promotion lands in `components/v2`.

## Components

| Export        | Role                                                                  |
| ------------- | --------------------------------------------------------------------- |
| `FacetBar`    | Horizontal chip row; optional `scrollable` for mobile                 |
| `FacetChip`   | Single filter chip with active state                                  |
| `SplitFilter` | Two-option pill toggle; re-clicking the active option clears (`null`) |

## Usage

```tsx
<FacetBar scrollable>
  <FacetChip label="All bands" active onClick={() => setBand(null)} />
  <FacetChip label="2m" active={band === '2m'} onClick={() => setBand('2m')} />
  <SplitFilter
    options={[
      { value: 'simplex', label: 'Simplex' },
      { value: 'split', label: 'Split' },
    ]}
    value={duplex}
    onChange={setDuplex}
  />
</FacetBar>
```

## Styleguide

Interactive demo on `/styleguide/patterns` (FacetBar section).

## Related

- [ChannelListFilters.tsx](./ChannelListFilters.tsx) — channels-specific facet wiring
- [docs/features/library/README.md](../../../../docs/features/library/README.md)
