# AT-D890UV Write-path safety (WATCH-08) — progress

**Tracking:** [#753](https://github.com/pskillen/codeplug-studio/issues/753) · epic [#645](https://github.com/pskillen/codeplug-studio/issues/645)  
**Branch:** `753/pskil/at-d890uv-write-fence`

## Status

| Slice | State |
| --- | --- |
| 0 Track + progress stubs | Done |
| 1 Allow-list extents + stop LocalInfo upload | Done |
| 2 Sentinel pre/post verify | Pending |
| 3 Airband-in-MR + encode guards | Pending |
| 4 Documentation | Pending |
| 5 Pre-PR verify + PR | Pending |

## Shipped this branch

_(none yet)_

## Manual verify (pending hardware — after merge)

- [ ] Fresh Read → Write → Read-back on spare AT-D890UV (pre-prod only)
- [ ] LocalInfo / optional-settings sentinels byte-identical after Write
- [ ] Usable UI; no password surprise
- [ ] Clear `prodWriteDisabled` only after operator clearance

## Related

- [at-d890uv-write-fence-outstanding.md](at-d890uv-write-fence-outstanding.md)
- Tier-3: [docs/reference/radios/anytone/at-d890uv/](../../reference/radios/anytone/at-d890uv/)
- Tracker: `tmp/at-d890uv-adapter-bugs.md` WATCH-08
