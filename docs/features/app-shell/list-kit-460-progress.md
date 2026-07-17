# List kit roles (#460) — progress

**Tracking:** [codeplug-studio#460](https://github.com/pskillen/codeplug-studio/issues/460)
**Plan:** List kit + styleguide (#460)
**Branch:** `460/pskil/list-kit-styleguide`

---

## Overall status

**Status:** In progress

**Branch:** `460/pskil/list-kit-styleguide`

---

## Slice 0: Role map docs

**Status:** Complete

**Delivered**

- `docs/features/app-shell/list-kit-roles.md` — A/B/C/D + surface map
- Progress / outstanding pair
- App-shell README documentation map rows

**Verify**

- Role map linked from app-shell hub

---

## Slice 1: Styleguide nested routes

**Status:** Complete

**Delivered**

- `/styleguide` index + `/layout`, `/data-table`, `/membership`, `/controls`
- Fixtures and demos under `src/app/routes/styleguide/`
- Removed monolith `StyleguidePage.tsx`

**Verify**

- Nested routes compile; old single-page demos still present

---

## Slice 2–3: DataTable A + D

**Status:** Complete

**Delivered**

- `orderMode` and `scale="extreme"` on `DataTable`
- Styleguide `/styleguide/data-table` full A demos + 10k extreme demo
- Sidecar + `data-table.md` + unit tests

**Verify**

- `vitest` DataTable tests pass

---

## Slice 4–6: B + C kit + membership styleguide

**Status:** Complete

**Delivered**

- `SelectedItemList` built-in move/remove/hotkeys
- `AvailableItemPicker` description + `sectionToolbar`
- `/styleguide/membership` paired + standalone demos
- Sidecars + unit tests

**Verify**

- SelectedItemList + DataTable tests pass; build green

---

## Next

- Slice 7: docs polish + PR (Addresses #460)
