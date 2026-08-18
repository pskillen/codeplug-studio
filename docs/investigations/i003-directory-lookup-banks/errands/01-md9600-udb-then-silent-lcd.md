# E1 — MD-9600 User Database Write, then silent-repeater LCD

**Status:** dispatched
**Assignee:** operator (hardware)
**Dispatched:** 2026-08-18 **Returned:**
**Code state:** post–[#1211](https://github.com/pskillen/codeplug-studio/issues/1211) User Database sidecar (qdmr `write_start`, no RMW of `0x50000`). UI still has Digital contacts None / Library / RadioID / Both until [#1249](https://github.com/pskillen/codeplug-studio/issues/1249).
**Blocks / blocked by:** none. Do not wait for #1249. Do not combine with Write keps only.

## Mission

Answer: **after a Write that actually programs User Database FLASH on this MD-9600, does the LCD show the directory callsign on an incoming digital call when the repeater does not send Talker Alias?**

Today’s blank LCD (`O/2026-08-18-lcd-silent`) is **not** that answer — Digital contacts **None** skips User Database `'X'` as well as the 1024 contact bank.

## Context you need

Two different names, two FLASH stores:

| What you see on the LCD                 | Store                                                                | Write-radio source that programs it |
| --------------------------------------- | -------------------------------------------------------------------- | ----------------------------------- |
| Incoming **caller** callsign / name     | User Database (call-sign DB) at FLASH `0x50000` (overflow `0xd8000`) | **RadioID** or **Both**             |
| Talk-group **name** (e.g. Worldwide 91) | 1024-slot DMR contact bank at `0xa7620`                              | **Library** or **Both**             |

This errand is about the **caller** row. Talk-group names are a different overlay (i007 / #1249).

Write-verify markdown **cannot** show User Database. Occupied sectors live outside `OPENUV380_FLASH_SPANS`. A 0-chunk verify after RadioID-only is expected for codeplug FLASH and proves nothing about UDB.

**None** (modal default every open) programs **neither** store. Opening the dialog and leaving the default is the same as skipping digital contacts.

Radio: TYT MD-9600 / RT-90, OpenGD77, Studio profile `radio-io-opengd77-md9600`. Same map as the 1701 that already ACK’d `'X'` (`R/2026-08-15-1701-udb-ack`).

Pick **one** known DMR ID that exists in the **RadioID directory shadow** (not only as a library talk group). Write that ID down before you start. The silent-path repeater must not send Talker Alias (same path as today’s miss).

## Work items

1. Confirm the RadioID shadow is **not** empty. If Studio warns about an empty directory, stop and say so — a Write would program a header with zero lookup IDs and still not prove LCD.
2. Open **Write radio**. Set Digital contacts to **RadioID** (preferred: one variable — User Database only). Optionally use **Write contacts only** rather than Write codeplug.
   - Use **Both** only if you also need the 1024 contact bank in the same session (TG names). That is a second overlay; note it in the report.
   - Do **not** leave **None**. Do **not** tick satellite keps.
3. After success: **Backup / Restore** on this build (`/builds/:id/backup`). Capture a new zip (do not reuse an older backup). Inspect should show a **User Database** row: `N lookup IDs (not the 1024 DMR contact bank)`. Note `N`, and whether it is in the same ballpark as the shadow you intended to write.
4. Optional but useful: unzip the backup and confirm region `user-database` starts with ASCII magic **`Id`**. Header is 12 bytes at FLASH `0x50000`.
5. On the same radio, make a digital call via the **silent** repeater. Record whether the LCD shows the **caller** callsign/name for the ID you wrote down. Ignore Talker Alias paths.

## Deliverable

In the Report section below:

- Write source used (RadioID vs Both; Write contacts only vs Write codeplug).
- Whether the Write UI showed a User Database / directory phase (not only “0 FLASH sectors”).
- Backup inspect: User Database `N`, plus DMR contacts count (that is the 1024 bank — do not treat it as lookup occupancy).
- Whether `user-database` bytes start with `Id` (if you unzipped).
- LCD: caller name present / absent for the chosen DMR ID. Repeater callsign / TG used.
- Firmware string if you have it.

Do not commit the backup zip or personal directory CSV.

## Success criteria

- **Backup inspect `N = 0` or no User Database row** after RadioID Write: H9 fail — `'X'` did not land (or Backup did not capture occupied sectors). LCD is then uninterpretable. That is the answer; do not call it an LCD bug.
- **`N > 0` and `Id` header, LCD still blank** on the silent path for an ID that is in that `N`: H8 is now a real encode/firmware-lookup miss. That is also the answer.
- **`N > 0` and LCD shows the caller name**: H8 cleared for MD-9600 on this firmware. Say so.
- **Could not Write / radio NACK `'X'`**: report the exact message. Same class as `O/1211-udb-nack` (1701, later fixed). Do not retry with keps bundled in.

---

## Report

<!-- written by the assignee; the brief above is immutable once dispatched -->

## Coordinator review

<!-- what was accepted, what was folded where, what is still open -->
