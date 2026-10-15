# Reverse-engineering a vendor CPS — lessons learned

These are lessons for agents (and humans) who statically reverse-engineer an official vendor CPS
(programming software) and then diff it against our `docs/reference/radios/<mfr>/<model>/` pages and our
`src/integrations/radio-io/` code.

They come from the first full run: the **Anytone AT-D890UV CPS v1.05**, October 2026. That run took 2 days and used
4 parallel agents plus Ghidra. Its working files were under `tmp/official-cps-rea/`, which is gitignored. Settled
facts from it belong in the radio's own reference pages.

## 1. Plan the deliverables before touching the binary

Agree the file layout up front and keep it stable:

| File                    | Purpose                                                                                               |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `README.md`             | File index + evidence convention                                                                      |
| `STATUS.md`             | Checkpoints, newest first, so the user can follow remotely                                            |
| `TRACKER.md`            | Blockers / open questions / gaps / decisions / merged key findings (IDs: B*, Q*, G*, D*, F*)          |
| `protocol.md`           | Transport, frames, handshake, retries, session state machine                                          |
| `memory-map.md`         | Region table + how the CPS decides what to read and write                                             |
| `records/<family>.md`   | One file per record family, each ending in `## Findings for lead`                                     |
| `report/`               | `README.md` (top findings), `protocol-diff.md`, `memory-map-diff.md`, `records-diff.md`, `ts-bugs.md` |
| `notes/toolkit.md`      | Tool usage, globals table, encoder/decoder address index — the brief every sub-agent reads            |
| `notes/lead-handoff.md` | Resume state for the lead (survives context compaction)                                               |

**Evidence convention.** Tag every byte-level claim as **[O]** (observed in code, with the address cited),
**[I]** (inferred) or **[?]** (unknown). Prefer tables to prose and hex to decimal.

## 2. Tooling

- **Identify the binary first.** Imports tell you the toolchain: `MSVBVM60.DLL` only means VB6 native code, and a
  `.NET` header means managed code, so use a managed decompiler. The serial-port imports (Win32
  `CreateFile`/`ReadFile`/`SetCommState`, or `MSComm`) are the fastest way into the protocol code.
- **A small annotated disassembler is the workhorse.** Build it with capstone + pefile in a scratchpad venv. Give it:
  - function bounds;
  - xrefs to an address;
  - import and runtime-helper annotation;
  - wide- and narrow-string constants inline.

  Include **direct call targets as function starts**, or the function finder merges neighbouring functions. Widen
  the immediate-xref range to cover the whole `.data` section.

- **Ghidra is a bonus, not the critical path.** On Ghidra 12.x with JDK 25:
  - `analyzeHeadless` and PyGhidra `open_program` both died in Felix OSGi ("data file must be inside the data dir").
    Clearing the felix cache did not help.
  - What worked: `pyghidra.start()` plus the `ghidra.base.project.GhidraProject` API (`createProject` /
    `importProgram` / `analyze`, then `DecompInterface`).
  - PyGhidra needs JPype, which had no Python 3.14 wheel, so use **Python 3.13**.
  - `analyzeHeadless.bat` breaks on paths containing `(x86)`; **copy the binary** into the scratchpad.
  - `proj.save` threw `ReadOnlyException`; use `saveAs`, and **decompile before saving** so a save error can't throw
    away the analysis.
  - **Decompile a priority list only, with a short timeout.** The huge VB6 procedures (whole-codeplug
    encoders/decoders, thousands of instructions) timed out at 180 s anyway. Agents fell back to the disassembler
    for almost every function that mattered.
  - Decompiling all ~2,400 functions ran for hours and contributed little. **Stop it once the priority list is
    done.**
- **Windows Python:** always `open(..., encoding='utf8')`. The cp1252 default truncated a script silently. Write tool
  scripts with the editor tool rather than shell heredocs.

## 3. Where the answers live in a CPS binary

The binary has **no struct or field names**. Find these anchors in order:

1. **Serial layer → command builders → reply validators → state machine.**
   - Each command builder sets an expected reply length. That gives exact frame sizes, which beats any guessing
     from captures.
   - The validator tells you what is checked: echoed address, length byte, checksum, trailer.
   - The state machine (`g_step` switch) gives session order, retries, and when `END` is or isn't sent.
2. **The read/write "what to transfer" builder _is_ the memory map.**
   - The D890 CPS kept a 1-byte-per-16-byte-block map built in passes:
     - static index regions (bitmaps, settings);
     - record bodies selected from those bitmaps;
     - for Write, an encode-everything pass that marks every block it writes.
   - Decoding those loops gives every address formula, including the non-obvious ones.
3. **Encoder/decoder pairs**, anchored by their error-message strings (`SetCommDataBy*` / `Get*FromCommData`).
   Remember to check the callees of the "encode all" and "decode all" routines for un-anchored ones.
4. **Field names come from outside the encoders:**
   - CSV export writers: header strings matched to the globals they serialise;
   - form control `Tag`s and captions;
   - language `.ini` IDs;
   - legacy project-file readers.

   Value ranges and clamps in the encoder give the enum bounds.

5. **The ident/handshake parser** may carry more than model and version. For the D890, byte 8 of the ident was a
   **band/region code** that the CPS compares with the codeplug before writing.

**VB6 specifics:**

- SAFEARRAY `+0xc` = data pointer, `+0x10` = count, `+0x14` = lower bound.
- `__vbaUI1I2` = `CByte`; `__vbaPowerR8(2,n)` = bit masks.
- Magic `0x10624dd3` = divide by 1000. `x & 0x8000007f` plus fix-ups = signed `Mod 128`.
- `__vbaCopyBytes(n, dst, src)` copies a UDT (record struct), and `n` is the struct size.

## 4. Running sub-agents

- **Split by record family**, not by address range: channel family, ID/contact family, settings family, plus one
  agent for the memory map and passes. Give every agent the same `notes/toolkit.md`, covering:
  - the tools;
  - the globals already identified;
  - the encoder/decoder index;
  - the evidence convention;
  - the output rules: write only your own files; end each file with `## Findings for lead`; don't edit
    STATUS/TRACKER.
- **Make agents write incrementally.** In the D890 run, all four agents hit the API session limit mid-task and had
  written **nothing**. They were resumed with their context intact (send a message to the same agent; don't spawn a
  new one), but a cold restart would have lost hours.
- **Forward cross-cutting results between agents.** The memory-map agent's TG bank-hop result changed what the
  talk-group agent needed to document.
- **Agents correct the toolkit.** Several early encoder labels were wrong (the TG encoder was mis-attributed, and
  the decode-all routine was misidentified). Merge those corrections into `TRACKER.md` as you go.
- **Keep the lead's context lean.** The lead merges `Findings for lead`, verifies key claims and writes the report.
  Write `notes/lead-handoff.md` before context gets large; agents and background jobs survive a compaction.

## 5. Verifying before reporting

Treat our existing docs and code as **hypotheses**, and treat agent output as **claims**. Before a finding goes into
the report as High:

1. **Re-read our TS code yourself.** Comments can lie: one function called itself BCD while round-tripping back to
   decimal.
2. **Use hardware-derived evidence we already have:**
   - committed forensic fixtures (D890: 181 real channel records proved the RX-group byte is 0-based);
   - wire captures of the official CPS (D890: they confirmed the sparse write model and the 25-slot satellite table).

   Check `docs/reference/radios/<model>/` and `docs/investigations/` for these first.

3. **Look for discriminating values.**
   - A u16 BE at `0x13` and a u32 LE at `0x14` agree for every index below 256. A flat stride and a bank-hopped
     stride agree for low indices. Fixtures full of small values "confirm" both models.
   - Say which model the evidence actually distinguishes, and which it doesn't.
4. **"The vendor tool writes X" is not "the radio requires X".** Static RE shows what the CPS does; the firmware is
   the arbiter. Where the evidence is static-only and our code has worked on hardware, recommend a **targeted
   hardware session** (write a minimal codeplug with the official CPS, then dump it with Studio) before changing
   encodings.
5. Add a **Verified** column to the report saying how each claim was checked: fixture / disasm / capture / TS
   re-read.

## 6. Bug classes to look for

Our first-pass radio docs often inherit from community tools (anytone-cps, qdmr, CHIRP drivers), and their mistakes
propagate. The D890 run found every one of these:

| Class                                                  | D890 example                                                                                                                                        |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bank-hopped strides** that look flat for low indices | Scan lists: 32 per `0x80000`. Talk groups: 1000 per `0x80000`.                                                                                      |
| **Hidden index / position→slot tables**                | TG table at `0x3900000` (identity on CPS Write, never written by us)                                                                                |
| **0- vs 1-based indices**                              | Channel RX group `0x1c`                                                                                                                             |
| **BCD vs binary**, per field                           | Radio IDs BCD; settings frequencies binary LE; channel frequencies BCD                                                                              |
| **Endianness**, per table                              | TG and contact order tables LE where we wrote BE                                                                                                    |
| **Field width and position**                           | Contact u32 LE at `0x14`, not u16 BE at `0x13`                                                                                                      |
| **Sentinel-terminated reads of fixed-length replies**  | Ident read until the first `0x06` even though a payload byte can be `0x06`                                                                          |
| **Missing guards the vendor enforces**                 | Band-code match before Write; version check                                                                                                         |
| **Contiguity/compaction assumptions**                  | The CPS compacts lists and stops reading at the first gap                                                                                           |
| **Fixed blind tables**                                 | Satellite: 25 slots, always fully written, zero-filled                                                                                              |
| **Rules from lore, not the vendor**                    | Safe-skip `0x2fa0010` and the flash marker blocks appear nowhere in the CPS. They may still be right (from hardware), but attribute them correctly. |

Also note what **matches**. A "confirmed as matching" list in the report is as useful to the next implementer as
the bug list.

## 7. Report shape that worked

- **`report/ts-bugs.md`**: numbered, severity-ranked, with `file:line`, CPS behaviour, effect, evidence tags, and a
  **suggested order of work**: unambiguous fixes first, then hardware-gated ones.
- One diff file each for protocol / memory map / records, with stable IDs (P*, M*, R*) so tickets can cite them.
- Turn the clearly separable fixes into follow-up sessions or issues. Keep anything that needs hardware confirmation
  out of those until it is confirmed.

## Related

- [anytone/at-d890uv/](anytone/at-d890uv/README.md): the first radio this was applied to
- [docs/investigations/](../../investigations/README.md): hardware investigations that often hold the
  discriminating evidence
- `dev-tools/wire-capture-decoder/`: decoding USB captures of the official CPS
