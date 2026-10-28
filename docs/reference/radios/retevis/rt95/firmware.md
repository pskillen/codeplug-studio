# Retevis RT95 — firmware (front panel)

Facts the firmware flasher needs for the RT95 **front panel** (the LCD / "head" MCU): the one stock firmware Studio
accepts, where to get it, and how to put the radio into update mode. Product rules:
[DESIGN.md — Firmware flashing](../../../../../DESIGN.md#firmware-flashing).

**Code mirror:** [`src/core/radios/retevis/rt95/firmware.ts`](../../../../../src/core/radios/retevis/rt95/firmware.ts)
(`RT95_HEAD_STOCK_FIRMWARE`, `RT95_HEAD_FIRMWARE_ROLE`). Keep the two in step.

**Pre-prod only, not yet checked on a radio.** The updater is registered with `prodFlashDisabled`, so it is offered on
next, dev and staging and hidden on prod ([#1460](https://github.com/pskillen/codeplug-studio/issues/1460)). Nothing has
been flashed from Studio to an RT95.

**The main board (MAIN) is never flashed by Studio.** The RT95 has two MCUs; the firmware project patches the front
panel only and keeps MAIN stock. Studio offers no MAIN target, pin or updater.

## Stock firmware pin

The user supplies the vendor zip, or the three head files from it. Studio never fetches, hosts or commits them. The zip
also holds the MAIN V1.61 files, the vendor's updater (QXCodePro) and a CPS installer; Studio inflates only the three
head members, matched by file name.

| Field      | Value                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Version    | `LCD V1.41 (20231202)`                                                                                                                      |
| Zip name   | `RT95 Upgrade software-Microphone gain adjustment.zip` (6,068,457 bytes)                                                                    |
| Zip sha256 | `4cbddc96bce718a9990137f3a83cb21dafb78101f0204ebd4fb41da6b8241089` (diagnostic: a re-zipped download is accepted when every member matches) |

| Role  | File name                         | Size (bytes) | sha256                                                             |
| ----- | --------------------------------- | ------------ | ------------------------------------------------------------------ |
| `cdd` | `RT95_LCD(NG)_V1.41_20231202.CDD` | 105,628      | `50c00fc44b3122e54e9e6ea7273519df1b1d05f136d5313120e10d7eb5b03b84` |
| `cdi` | `RT95_LCD(NG)_V1.41_20231202.CDI` | 278          | `a8970f8d6327630569426936465fa40a6734fa0cf91d2f84d21354e7b5ad2b4a` |
| `spi` | `RT95_LCD(NG)_V1.41_20231202.spi` | 10           | `29f97d17af27624d43ed192dc54ed36ed41b852f684a4fc16391e483fbf90164` |

### Stock sources

The wizard lists both as plain text or links; Studio never fetches either.

| Source                | What it is                                                                                                                                                                                                                                                                              |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Email Retevis support | Retevis sends the 2024 mic-gain update package on request. Contact: [the Retevis contact page](https://www.retevis.com/pages/contactus)                                                                                                                                                 |
| Unofficial mirror     | `http://47.253.5.16/soft/RT95%20Upgrade%20software-Microphone%20gain%20adjustment.zip`. A bare IP, **not run by Retevis**, over **plain HTTP**: the browser may warn that the download is not secure. Safe to use only because Studio checks every file against the pinned hashes above |

## Update-mode entry

Indicator: **blank screen**.

1. Take a backup with Studio's Read first.
2. Switch the radio off.
3. Hold **P1** and press and hold the **channel knob**, then switch the radio on.
4. The screen stays blank: that is update mode.
5. Connect the programming cable.

**Warning — P3 is the wrong mode.** P3 + knob also answers the vendor's handshake, but it relays to the **main board**
and the screen shows `UPDATE THE / RF CPU`. Studio cannot tell the two modes apart on the wire; the screen is the only
tell. If you see that text, switch off and start again.

**Warning — serial numbers before 2101.** The 2024 package is documented for serials 202101 and later. First-revision
radios are reported bricked by it.

After a stock flash, hold FUNC + P4 while switching on: the test screen shows `LCD CPU: V1.11`. Turn the knob only,
then switch off.
