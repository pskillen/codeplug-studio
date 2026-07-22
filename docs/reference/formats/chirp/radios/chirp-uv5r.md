# Baofeng UV-5R Mini — CHIRP profile

**Profile id:** `chirp-uv5r`  
**Fixture:** `formats/chirp/__fixtures__/export/Baofeng_UV-5R Mini_20251129.csv`  
**Max RF:** 5 W

## Limits

| Constraint       | Value    | Export behaviour                                                         |
| ---------------- | -------- | ------------------------------------------------------------------------ |
| Max memory slots | 999      | Warn when channel count exceeds; truncate lowest-priority rows if forced |
| Channel name     | 12 chars | Name shortening at export boundary                                       |
| Modes            | NFM, AM  | Skip non-FM/AM internal modes with warning                               |

Flat-memory CHIRP profiles do **not** use zones, scan lists, contacts, talk groups, or RX group lists. Radio characteristics marks those rows as not used (`getProfileExportLimits`).

## Sibling path: NeonPlug UV5R-Mini binary

[NeonPlug UV5R-Mini](../../neonplug/radios/uv5rmini.md) targets the same radio family over Web Serial with the **same** memory/name caps (**999** memories, **12**-char names). Delivery differs (binary vs CHIRP CSV); caps are aligned for UV-5R Mini.

## Wire verification

`cps-verify` profile `chirp-uv5r` enforces the memory-slot and name-length caps above, plus LF / selective quoting / exact headers documented in [CHIRP README — Wire verification](../../README.md#wire-verification).

## Power ladder (wire → percent)

Percent aligned to CHIRP UV17Pro High 5 W / Low 1 W (`baofeng_uv17Pro.py` / `UV5RMini`). Studio exports Generic CSV **watt** strings. `null` internal percent exports as high (`5.0W`).

| Wire   | Watts | Percent |
| ------ | ----- | ------- |
| `5.0W` | 5 W   | 100     |
| `1.0W` | 1 W   | 20      |

**Re-verified** against CHIRP source after UV-5R Mini cap fix ([#584](https://github.com/pskillen/codeplug-studio/issues/584) / [#602](https://github.com/pskillen/codeplug-studio/issues/602)): `CHANNELS=999`, `LENGTH_NAME=12`.

## Filename convention

`Baofeng_UV-5R Mini_{YYYYMMDD}.csv`

## Related

- [Profile index](README.md)
- [channels.md](../channels.md)
- [NeonPlug UV5R-Mini](../../neonplug/radios/uv5rmini.md)
