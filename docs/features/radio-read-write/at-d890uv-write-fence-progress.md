# AT-D890UV Write-path safety (WATCH-08) — progress

**Tracking:** [#753](https://github.com/pskillen/codeplug-studio/issues/753) · epic [#645](https://github.com/pskillen/codeplug-studio/issues/645)  
**Branch:** `753/pskil/at-d890uv-write-fence`

## Status

| Slice | State |
| --- | --- |
| 0 Track + progress stubs | Done |
| 1 Allow-list extents + stop LocalInfo upload | Done |
| 2 Sentinel pre/post verify | Done |
| 3 Airband-in-MR + encode guards | Done |
| 4 Documentation | Done |
| 5 Pre-PR verify + PR | In progress |

## Shipped this branch

- `writableExtents.ts` — `AT_D890_WRITABLE_EXTENTS` allow-list; filters `listWriteChunks` and `atD890WriteMemory`
- LocalInfo no longer serial-written; `writeRole` kept = not uploaded
- `sentinelVerify.ts` — pre/post Read of LocalInfo + optional settings; fail Write on delta
- `channelEncodeGuards.ts` — AM airband-in-MR and BCD-encodable Hz hard failures
- Tier-3 Write contract + feature hub updated ([#753](https://github.com/pskillen/codeplug-studio/issues/753))

## Manual verify (pending hardware — after merge)

- [ ] Fresh Read → Write → Read-back on spare AT-D890UV (pre-prod only)
- [ ] LocalInfo / optional-settings sentinels byte-identical after Write
- [ ] Usable UI; no password surprise
- [ ] Clear `prodWriteDisabled` only after operator clearance

## Related

- [at-d890uv-write-fence-outstanding.md](at-d890uv-write-fence-outstanding.md)
- Tier-3: [docs/reference/radios/anytone/at-d890uv/](../../reference/radios/anytone/at-d890uv/)
- Tracker: `tmp/at-d890uv-adapter-bugs.md` WATCH-08
