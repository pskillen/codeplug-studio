# Membership ordering — progress

**Tracking:** [codeplug-studio#456](https://github.com/pskillen/codeplug-studio/issues/456) · [codeplug-studio#155](https://github.com/pskillen/codeplug-studio/issues/155)
**Plan:** `.cursor/plans/membership_ordering_456_9d594662.plan.md`
**Branch:** `456/pskil/membership-ordering`

---

## Overall status

**Status:** Complete (pending merge)

**Branch:** `456/pskil/membership-ordering`

---

## Slices 0–5

**Status:** Complete

**Delivered**

- Schema v20 `Zone.order`; assemble cascade; membership helpers
- Library UI: zone list reorder, scan-list member reorder, Sort… menus
- Build UI: zone `orderOrSlot` reorder + member order modal
- Tier-1 docs; follow-up [#457](https://github.com/pskillen/codeplug-studio/issues/457)

**Verify**

- `npm run format:check && npm run lint && npm run test && npm run build`
- Manual: library zones / members / scan / RGL Sort…; build Zones reorder

---

## Next

- Open PR (`Closes #456` · `Closes #155`)
