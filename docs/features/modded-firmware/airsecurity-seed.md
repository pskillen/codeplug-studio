# Brandmeister AirSecurity seed

The MM9PDY firmware on the AT-D890UV can hold one Brandmeister AirSecurity seed. Studio is the only writer. The seed is not a radio-settings field. It is not kept in local storage, session storage, IndexedDB, a project, or a build override. Check-write data leaves the seed span out.

The operator supplies either the self-care text (32 Base32 characters, shown as eight groups of four) or a Brandmeister `otpauth://totp/` link. Studio accepts any letter case, spaces anywhere, and optional `=` padding. A link may omit `issuer`. It must be TOTP with SHA1, 6 digits and a 30-second period; those three are the defaults when the link leaves them out. Studio refuses HOTP, any other algorithm, digit count or period, an empty seed, a character that is not Base32, a length that is not a whole number of bytes, and a seed longer than 20 bytes. The refusal says what is wrong and does not repeat the text that was offered.

A write or a clear runs only for the MM9PDY AT-D890UV target. Any other target is refused before the radio is read, and nothing is sent. The write replaces the seed record and leaves every other byte of the settings unit as the radio held it, including the M6 settings store next to the record. Studio never writes that store. A clear writes a blank record, which the firmware treats as no seed. A read reports only whether a seed is set.

A backup taken while a seed is set contains the record, and Restore writes it back. The debug memory viewer masks the record until it is revealed. A backup zip, debug capture or region dump taken while a seed is set contains the seed in clear (the viewer masks it, the file does not); do not share one for support without clearing the seed first. The record layout is in the [AT-D890UV memory layout](../../reference/radios/anytone/at-d890uv/memory-layout.md). The firmware's own seed-record page is authoritative for that layout.

## On the radio settings page

The MM9PDY AT-D890UV radio settings page (`/builds/:id/export/radio-settings`) includes **Brandmeister AirSecurity**. The stock AT-D890UV target and every other radio do not. The screen is [AtD890AirSecuritySeedCard](../../../src/app/components/builds/AtD890AirSecuritySeedCard.md).

The operator pastes the self-care text or the `otpauth://` link into **AirSecurity seed** (placeholder _Paste the Selfcare text or the otpauth:// link_). The field is masked and has no reveal control. Until the radio is asked, the state is **Not checked**. **Check radio** then shows **Seed set** or **No seed**.

**Check radio**, **Write seed**, and **Clear seed** each open their own radio session and close it. **Write seed** stays off until the paste is accepted. A bad paste shows the refusal and does not repeat the text. A radio error shows that error's message. A write or a clear does not read the seed back; the page shows what was just sent. After a write it says _Seed written. The radio restarts; wait about 20 seconds._ After a clear it says _Seed cleared. The radio restarts; wait about 20 seconds._ and the state is **No seed** or **Seed set** to match.

The section always says: _Backups contain the seed. Clearing the seed does not remove it from backups you have already taken._

When the paste is an `otpauth://totp/` link whose label is `BrandMeister:` and a DMR ID, and that ID is not one of this library's DMR IDs, the page says _The link is for DMR ID {id}, which is not one of this library's DMR IDs._ Write seed stays available. Self-care text has no DMR ID, so it does not show that warning. An NXDN ID with the same number does not count.

## Backup warning

On Backup / Restore, when the backup on screen (a live read or an opened file) is an AT-D890UV backup and its settings-store record is a seed, Studio shows: _This backup contains the radio's Brandmeister AirSecurity seed. Keep the file safe: anyone with it can authorise your DMR ID. Clearing the seed later does not remove it from this file._

That check uses the bytes the backup already holds. Studio does not read the radio to decide it, and it does not show the bytes. A blank record shows no warning.

## What Studio never stores

The paste and the parsed bytes live only in the seed section. They are wiped after Write seed, after Clear seed, and on leaving the page. They are not written to browser storage, the project, a build override, the settings session, a URL, the console, or an error message. A backup file can still hold the record, which is why both warnings are there.
