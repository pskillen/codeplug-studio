# Help & in-app writing style guide

Used by agents and humans writing **user-facing copy** for Codeplug Studio: long-form help pages, inline hints, field descriptions, tooltips, empty states, and error and warning messages. It also steers user-facing prose in the [README](../../../README.md).

For **which UI shell to build** (lists, Sort…, membership), see the [UI interaction styleguide](../styleguide/README.md) — complementary, not a substitute.

This guide governs **wording**. It does not change _where_ content lives — documentation tiers and vendor boundaries still apply (see [Boundaries](#boundaries)).

Ported from the archived [codeplug-tool](https://github.com/pskillen/codeplug-tool) prototype and adapted for Studio's library + builds model.

---

## 1. Who we're writing for

Our reader is a **radio amateur**, not a software user who happens to do radio.

- Passionate about the hobby; technical skill varies widely.
- Often **not comfortable with computers**. CPS tools are a necessary evil; some operators avoid them entirely and get a friend to program their radio.
- **Fluent in the domain** — frequencies, tones, offsets, simplex/duplex, DMR vs FM. Don't explain radio to them.
- **May not know our software vocabulary.** They know _zones_ and _channels_. They may not know _scan lists_, _RX group lists_, or _promiscuous receive_ — or may know the idea under a different name.
- **Know their own radio well, but not others.** They likely don't know that programming conventions differ between radios and CPS tools. This gap is exactly what Studio smooths over, so help should bridge it without assuming they've seen any particular CPS.

**Write for the nervous newcomer without boring the expert.** Lead with plain language; keep the precise term close by so a confident reader isn't slowed down.

---

## 2. Voice & tone

Studio makes a tedious job pleasant. We believe that — and it shows in clarity and confidence, **not** in adjectives.

- **Confident, never boastful.** Show Studio is good by making tasks obvious. Never tell the reader the tool is "powerful", "revolutionary", "amazing", or "easy".
- **Calm and encouraging.** The reader may be anxious about breaking their radio. Reassure with facts ("nothing is uploaded", "you flash the radio in your CPS as the last step"), not cheerleading.
- **On the reader's side.** We know the CPS pain. A light, knowing nod to shared frustration is fine; sarcasm and snark are not.
- **Respect their expertise.** Never condescend about radio. Do gently fill gaps in _software_ concepts.

| Do                                                                                          | Don't                                                            |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| "Import an existing codeplug, or start a blank project."                                    | "Our powerful import engine effortlessly handles your codeplug!" |
| "Your projects stay in your browser — nothing is uploaded unless you save to Google Drive." | "Don't worry, it's totally safe and super easy!"                 |
| "A zone groups channels so you can switch between them on the radio."                       | "As any operator knows, zones are simply..."                     |

---

## 3. Plain language & jargon

The rule: **don't reach for jargon to sound clever; reach for it to avoid tedious repetition.**

- Prefer the plain word when it's just as precise (`use` over `utilise`, `set up` over `configure` where natural).
- Introduce a software term **once**, in plain language, then use the term freely:
  > An **RX group list** is the set of talk groups a channel will receive. Once defined, you can reuse the same RX group list across many channels.
- Assume **radio** vocabulary is shared; assume **app** vocabulary is not. "Squelch" needs no gloss; "scan list" does, the first time on a page.
- Avoid **contributor / developer jargon** in user-facing text entirely: no adapter names, schema versions, FK/UUID, "the internal model", "traits", component or route names.
- Define terms where the reader meets them, and/or in a shared **glossary** (see §7). Don't make them hunt.

---

## 4. Grammar & mechanics

- **British English.** Match the codebase: _visualise, colour, organise, licence (noun), behaviour, centre_. (Keep US spelling only inside code identifiers/APIs.)
- **Second person, active voice.** "You import the CSV into your CPS." Not "The CSV is imported by the user."
- **Present tense** for how things work: "The map shows channels with valid coordinates."
- **Short sentences.** One idea each. Break a long sentence before adding a comma-and.
- **Sentence case** for headings, buttons, and labels ("Import & export", not "Import & Export").
- **Oxford comma**: optional but be consistent within a page.
- **Numbers**: numerals for anything countable in the UI ("3 channels", "2 talk groups").
- **Contractions** are welcome ("don't", "you'll") — they keep the tone human.
- **No emojis** in product copy unless explicitly requested.

---

## 5. Referring to the UI

- Name UI elements **exactly** as they appear, in **bold**: click **Export**, open the **Settings** page.
- Use the real verb for the control: _click_ a button, _select_ from a list, _toggle_ a switch, _enter_ text.
- Don't describe pixel positions ("the button in the top-right") — layout shifts and breaks on mobile. Use the label and, if needed, the section ("under **Storage**").
- Keep terms consistent with what the app actually says. If the app says "talk group" don't write "talkgroup" or "TG" in prose (abbreviations are fine _after_ introducing the full term, or in tight inline hints).

---

## 6. The two help tiers

Help is **additive** — the UI stays primary. Two tiers, two voices:

### Inline / nearby (short)

Field descriptions, info icons, expandable hints, empty states, warnings.

- **Lead with the answer.** The reader is mid-task.
- One or two sentences. If it needs more, link to long-form.
- Say what the field/control _does_ and, when non-obvious, _why you'd change it_ or what a safe default is.
- Warnings: state the risk plainly and what to do. "Some formats can't store every field — fields that don't fit are dropped on export."

### Long-form help (deeper)

The **Help** page and any future walkthroughs: workflows, glossary, links to in-app reference.

- Task- and workflow-oriented ("Import an existing codeplug", "Build for your radio"), not feature-catalogue.
- Use the operator lifecycle as the spine (curate library → build per radio → export); keep it consistent with [`operator-lifecycle.md`](../../features/workflows/operator-lifecycle.md).
- Structure with short sections, steps as numbered lists, and cross-links to inline-help surfaces and reference routes.
- Safe to assume more attention than inline, but still scannable.

---

## 7. Terminology & glossary

Maintain a **single source of truth** for our terms so inline and long-form copy agree.

- One canonical term per concept (e.g. "talk group", not a mix of "talkgroup"/"TG list"/"contact group").
- Each glossary entry: the term, a one-line plain definition, and (optionally) the radio-world analogy the reader already knows.
- Prefer the reader's existing mental model: relate **scan list** to scanning they already do; relate **zone** to what their radio calls a zone.
- When our term differs from a common CPS term, acknowledge it once rather than pretending only our name exists.

**Studio's library vs codeplug wording.** Internally the app is organised as a **library** (your master inventory) and per-radio **builds** — see [DESIGN.md — Glossary](../../../DESIGN.md#glossary). User-facing copy may still say "codeplug" where the operator would; use **library** and **build** when the distinction matters (e.g. "the same channel can appear in several builds").

_(Where the glossary physically lives — a help page, a shared content manifest — is an implementation decision for the build, not this guide.)_

---

## 8. Boundaries (format- & vendor-neutral) {#boundaries}

User-facing help must stay **format-agnostic** when describing the internal model. This mirrors the contributor doc rules — don't undo them in user copy.

- Describe **what the tool does**, not one radio's or one CPS's quirks. OpenGD77 is one format among siblings (CHIRP, DM32, Anytone, native YAML), not the definition.
- **No wire detail in general help**: no CSV column names, no per-format values, no radio caps. Link out to the import/export hub or per-format reference (`docs/reference/<format>/`).
- Don't let one radio's terminology become the default. If behaviour is format- or radio-specific, say so explicitly and scope it.
- Full rules: [`documentation-boundaries.mdc`](../../../.cursor/rules/documentation-boundaries.mdc), [`format-agnostic-docs.mdc`](../../../.cursor/rules/format-agnostic-docs.mdc), [`vendor-boundaries.mdc`](../../../.cursor/rules/vendor-boundaries.mdc), [`AGENTS.md` — Vendor boundaries](../../../AGENTS.md#vendor-boundaries).

---

## 9. Accessibility & format

- **Mobile / narrow screens**: copy must read well in a narrow column. Short paragraphs, no "see the panel on the right".
- **Scannable**: front-load the key point; use lists and bold sparingly for real emphasis.
- **Link text describes the destination** ("see the export workflow"), never "click here".
- **Plain over decorative**: no walls of caveats; lead with the common case, footnote the edge case.
- Don't block the workflow: no forced tours, no modal the reader must dismiss to proceed.

---

## 10. Quick checklist

Before shipping a piece of user-facing copy:

1. Would a **nervous, non-technical operator** understand it on first read?
2. Does it **respect their radio expertise** (no explaining the hobby)?
3. Did I introduce every **app term** in plain language before leaning on it?
4. Any **developer/contributor jargon** (adapter, schema, FK, traits, route names)? Remove it.
5. Any **format/radio specifics** leaking into general copy? Move to reference and link.
6. **British spelling**, sentence case, second person, active voice?
7. Do **UI names match the app** exactly, in bold?
8. Reads well on a **narrow screen**?
9. Confident and helpful **without boasting**?
