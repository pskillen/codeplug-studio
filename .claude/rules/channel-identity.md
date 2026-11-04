---
paths:
  - "src/app/**/*"
  - "docs/reference/styleguide/**/*"
---

# Channel identity: callsign and name together

**Critical rule.** A channel's **callsign** is its licensed identifier; its **name** is an operator-chosen label. Not every channel has a callsign, but **where one is present it is more important than the name**.

Wherever the UI identifies a channel, **show the callsign and the name together**, callsign first; name alone only when there is no callsign. Omitting either needs a clear reason written in a code comment (e.g. a CPS wire-name preview showing the exported string).

Applies to: tables (a **Callsign** column before **Name**, or callsign + name in one identity cell), phone identity lines, pickers and comboboxes, zone / scan-list member rows, map labels, tooltips and popups, confirm dialogs, summaries and toasts.

Also:

- **Search** over channels matches callsign as well as name.
- **Sort** offers callsign wherever it offers name.
- Read `callsign` as optional: trim it, render `—` in an empty table cell, never the empty string as a label.

When editing a channel table, picker or summary that shows the name without the callsign, **fix it or flag it** — do not copy the pattern.

Full guidance: [docs/reference/styleguide/display.md — Channel identity](../../docs/reference/styleguide/display.md#channel-identity-callsign-and-name-together).
