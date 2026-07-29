# Generic write verify platform — progress

**Tracking:** [#838](https://github.com/pskillen/codeplug-studio/issues/838) · epic [#632](https://github.com/pskillen/codeplug-studio/issues/632)  
**Branch:** `838/pskil/write-verify-adapters`

---

## Overall status

**Status:** In progress (Phase 1 adapters)

**Branch:** `838/pskil/write-verify-adapters` from `origin/main`

**Prerequisite:** Phase 0 merged ([#838](https://github.com/pskillen/codeplug-studio/issues/838) platform + D890).

---

## Phase 0 — platform + D890 migration

| Slice                                                           | State |
| --------------------------------------------------------------- | ----- |
| 0 Kickoff branch + progress files                               | Done  |
| 1 Neutral types + `WriteVerifyHooks` on descriptor              | Done  |
| 2 D890 descriptor hooks + generic session API                   | Done  |
| 3 Generic `writeVerifyStorage` (`profileId` match)              | Done  |
| 4 `WriteVerifyReport` + panel gate via `descriptor.writeVerify` | Done  |
| 5 Feature docs + protocol note + PR                             | Done  |

---

## Phase 1 — adapters + reconnect UX

| Slice                                      | State       |
| ------------------------------------------ | ----------- |
| 0 Branch + extend progress/outstanding     | Done        |
| 1 Soft vs hard reconnect UX                | Done        |
| 2 Shared MemoryMap staging compare helpers | Pending     |
| 3 RT95 write verify                        | Pending     |
| 4 UV-5R Mini + UV-21 write verify          | Pending     |
| 5 OpenGD77 1701 + MD9600 write verify      | Pending     |
| 6 DM-32UV write verify                     | Pending     |
| 7 Feature docs + PR                        | Pending     |

### Adapter checklist

| Radio              | `writeVerify` hooks | `requiresCrossSessionReconnect` |
| ------------------ | ------------------- | ------------------------------- |
| AT-D890UV          | Done (Phase 0)      | `true`                          |
| RT95               | Pending             | `false`                         |
| UV-5R Mini / UV-21 | Pending             | `false`                         |
| OpenGD77 1701      | Pending             | `true`                          |
| OpenGD77 MD9600    | Pending             | `true`                          |
| DM-32UV            | Pending             | `false`                         |

---

## Delivered (Phase 0)

- `src/integrations/radio-io/writeVerify.ts` — neutral contracts + staging JSON helpers
- `radios/at-d890uv/writeVerifyHooks.ts` — D890 adapter mapping
- `radioIoSession.ts` — `uploadPreparedRadioWrite` / `verifyRadioWrite` (no app `instanceof`)
- `writeVerifyStorage.ts` — `radioIo.writeVerify.pending` with `profileId` guard
- `WriteVerifyReport.tsx` — generic report shell + sidecar
- [write-verify.md](write-verify.md) — extension pattern

---

## Related

- [write-verify-platform-outstanding.md](write-verify-platform-outstanding.md)
