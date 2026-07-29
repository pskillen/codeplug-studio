# Generic write verify platform — outstanding

Items **skipped**, **incomplete**, or **discovered during execution** — not scheduled Phase 1 adapter work.

**Tracking:** [#838](https://github.com/pskillen/codeplug-studio/issues/838) · branch `838/pskil/write-verify-adapters`

---

## Phase 1 adapter work (this branch)

| Radio              | Staging                         | Read-back                         | Reconnect UX |
| ------------------ | ------------------------------- | --------------------------------- | ------------ |
| RT95               | 16 B blocks `0x0000`–`0x3290`   | full `download()`                 | soft         |
| UV-5R Mini / UV-21 | 64 B plaintext at radio addresses | full `download()` (decrypt)       | soft         |
| OpenGD77 1701/9600 | `collectDirtySectors` payloads  | full `download()` after reboot    | hard         |
| DM-32UV            | post-remap 4 KB upload blocks   | discover + bulk read staged addrs | soft         |

---

## Hardware verify

- [ ] Manual AT-D890UV Write → reboot → Verify write smoke (regression)
- [ ] Manual RT95 / UV / DM32 soft-reconnect verify smoke
- [ ] Manual OpenGD77 hard-reconnect verify smoke

---

## Deferred / out of scope (#838)

- DM-32 digital contact bank verify by default (matches Read — contact bank not folded into hydration)
- D878UVII and other Anytone maps beyond D890
- CSV / file-export verify
