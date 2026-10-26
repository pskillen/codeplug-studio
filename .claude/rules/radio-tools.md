---
paths:
  - "src/integrations/radio-io/radios/**/rangeChange/**"
  - "src/app/routes/builds/radio-tools/**"
  - "src/app/services/radioTools/**"
  - "src/integrations/persistence/rangeChangeJournal*"
  - "docs/features/radio-read-write/radio-tools*.md"
---

# Radio tools

**Critical rule.** When editing related files, if you notice existing code or docs that violate this rule — even
outside your current task — **flag it to the user as a high concern** before or alongside your main work.

Read [DESIGN.md — Radio tools](../../DESIGN.md#radio-tools).

## Rules

- **A tool runs only from its own wizard.** Never from Write, Restore or Backup.
- **Backup first, checked.** Refuse to touch the radio until the backup is saved and re-opened.
- **One guarded send path per tool, with its own allow-list, as narrow as the change.** Hard interlocks are code: no
  setting, flag, env value or query parameter may disable one. Each interlock has a refusal test.
- **The range-change sender is the only code that writes LocalInfo.** Generic write helpers hard-deny
  `0x04F00000..0x04FFFFFF`. Only files under `rangeChange/` import the sender or its extent
  (`rangeChangeBoundary.test.ts`). Never address `0x04FC0000`, never send PC-link `H`, never touch sector markers.
- **Interlocks never read the decisions file** (`src/app/services/radioTools/decisions.ts`). Decisions are copy,
  confirm method and timings; interlocks are not decisions.
- **Say "Nothing has changed" at every exit before the first write**, and offer a resumable recovery after it. Send
  `END` only when the error says it is safe (`endSafe`).
- **Per-tool prod gate.** A tool's prod-disabled flag is cleared only in its own commit, after the owner has run the
  tool on a radio.
- **Radio tools are not Write.** Don't reuse `radioWriteEnvGate`, the Write stepper or the restore plumbing.
