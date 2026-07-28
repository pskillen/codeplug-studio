# Radio limits source of truth

Hardware cardinality, RF band bounds, and name-length ceilings for a radio model have one **code** module and one **human** doc:

| Kind | Path |
| --- | --- |
| Code | `src/core/radios/<manufacturer>/<model>/limits.ts` |
| Docs | `docs/reference/radios/<manufacturer>/<model>/limits.md` |

Format profiles (`formats/<format>/profiles.ts`) and radio-io profiles **import** from that module. Protocol-only layout sizes may stay in `integrations/radio-io/`, but cardinality must re-export from core.

**Shipped modules (2026):** Baofeng DM-32UV, OpenGD77 family, Anytone AT-D890UV.

**Audit background:** [export limits placement audit](../../tmp/export-limits-placement-audit/00-findings.md) (H1–H4, M1–M11). Remaining items after #813: [01-unresolved-after-813.md](../../tmp/export-limits-placement-audit/01-unresolved-after-813.md).

## Declared-but-unenforced caps (M6)

These profile fields document radio facts but **do not** truncate or warn on the listed CSV/export path today. Enforcement may follow under pathway parity work ([#813](https://github.com/pskillen/codeplug-studio/issues/813)).

| Profile / path | Field | Notes |
| --- | --- | --- |
| DM32 `dm32-baofeng-dm32uv` | `maxContacts`, `maxTalkGroups`, `maxZones` | Contacts/TGs/zones serialise without count caps; zone member warnings only |
| NeonPlug `neonplug-dm32uv` | `maxTalkGroups` | Talk groups not truncated on NeonPlug org export |
| Anytone `anytone-at-d890uv` | `rxGroupListMembers` | RGL member cap documented; not warned/truncated on Anytone CSV export |
