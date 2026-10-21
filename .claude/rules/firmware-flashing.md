---
paths:
  - "src/core/firmware/**"
  - "src/core/services/firmware/**"
  - "src/core/radios/**/firmware.ts"
  - "src/integrations/radio-io/firmware/**"
  - "src/integrations/radio-io/radios/**/firmwareUpdate/**"
  - "src/app/routes/firmware/**"
  - "src/app/services/firmwareFlash*.ts"
  - "docs/features/firmware-flashing/**"
---

# Firmware flashing

**Critical rule.** When editing related files, if you notice existing code or docs that violate this rule — even
outside your current task — **flag it to the user as a high concern** before or alongside your main work.

Read [DESIGN.md — Firmware flashing](../../DESIGN.md#firmware-flashing).

## Rules

- **No vendor bytes, ever.** Never commit a stock image, a vendor zip, or any slice of one: not in `src/`, test
  fixtures, docs or scripts. Tests build synthetic images with hashes computed on the fly. Studio's own release patch
  files under `src/core/firmware/releases/` are the only committed firmware-derived files, and they are copied byte
  for byte from the firmware projects' releases.
- **Hard interlocks are code.** No setting, flag, env value, query parameter or patch field may disable one. Each
  interlock has a refusal test.
- **One send path per updater.** Every byte to a bootloader goes through the guarded send helper, the only
  `pipe.write` call site in firmware code. A guard refusal aborts the session; it is never retried or swallowed.
- **Generic code is vendor-neutral.** Code in `src/core/firmware/` (outside `patch/formats/`) and
  `src/core/services/firmware/` works on member roles and hashes. File extensions, offsets and wire keys live only in
  `patch/formats/<patch-name>/` and the radio's `firmware.ts` / `firmwareUpdate/`.
- **No radio literals in `src/app/`.** USB IDs, timeouts, entry steps and verify hints come from descriptors.
- **Release patches are byte-exact.** Never reformat `*.patch.json` (they are in `.prettierignore` and `-text` in
  `.gitattributes`).
- **Per-radio prod gate.** A radio's `prodFlashDisabled` is cleared only in its own commit, after Studio has flashed
  at least one patched release to that radio on hardware.
- **Flash is not Write.** Don't reuse `radioWriteEnvGate`, egress or build plumbing for firmware.
