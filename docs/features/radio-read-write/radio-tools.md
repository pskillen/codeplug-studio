# Radio tools

Rare jobs that change the radio itself, not the codeplug (**#1369**). A tool runs only from its own wizard, never from Write, Restore or Backup. Today the area lists one tool, **Change frequency range** (AT-D890UV, both targets), with no **Start…** yet: the wizard is a later PR.

## Implementation status

| Piece                                                                        | Status                                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------ |
| Area: page, registry, gate, entry points, nav                                | Shipped (pre-prod only: hidden on the prod site) |
| Change frequency range: engine (session, single frame, verify)               | See the range-change engine PR                   |
| Change frequency range: wizard, journal, banners, Restore guard (**Start…**) | Planned                                          |
| Change frequency range: offered on the prod site                             | Planned, after the owner's radio checks          |

## The area

- **Route:** `/builds/:id/export/radio-tools` (`BuildRadioToolsPage`). It sits under a build because the build's Web Serial egress is the only door to a radio today. It is **not** a strip tab, a Write stepper step or a Backup page action: `activeBuildSection` maps it (and anything below it) to Export, so the Export tab stays lit.
- **Page:** title **Radio tools**, a fixed red strap ("These change the radio itself. A Write can't undo them."), then one [`RadioToolCard`](../../../src/app/components/radioTools/RadioToolCard.md) per offered tool: what it does, what it costs, how long, and **Start…** when the tool has a `route`. Nothing on the page touches the radio. Danger colour is used once per screen (the strap). Below the cards is a footer slot for the wizard PR ("Finish a range change from a backup file", "Last change: …").
- **Entry points:**
  1. The **last card** of the AT-D890UV Export panel (`RadioToolsCard`, after **What Write updates**): collapsed red-edged "Radio tools · Changes the radio itself"; open: "Rare jobs that change the radio, not your codeplug. Each one backs up first." and **Open radio tools**.
  2. The Radio settings page's read-only **Frequency range** row: "<range> · **Change…**" (shown only after a Read, only when the area is offered). The "Why can't I change these?" text says the range can be changed from Radio tools, or "Studio can only show it" when the area is not offered.
- **Not offered** (prod site, a radio with no tool, a build with no Web Serial egress, or the Capacitor app where Web Serial isn't available): both entry points are hidden and the route redirects to `/builds/:id/export`.
- **Build switch:** `pathForSwitchedBuild` keeps `export/radio-tools` only when the target build also shows it (`showsRadioToolsNav`), else lands on Export.

## Registry and gate

`src/app/services/radioTools/`:

| File           | Role                                                                                                                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registry.ts`  | `RADIO_TOOLS`: `{ id, title, summary, cost, minutes, radios, prodDisabled, route? }`. `radios` lists `RadioBuild.radioTargetId` values (the D890 stock and MM9PDY targets are separate ids)       |
| `gate.ts`      | `resolveRadioToolGate(tool, buildEnv)` → `'hidden' \| 'allowed'` (hidden only on `prod` while `prodDisabled`); `listOfferedRadioTools(radioTargetId, buildEnv)` (also empty in the Capacitor app) |
| `decisions.ts` | `RADIO_TOOLS_DECISIONS`: the area's name and strap. Owner decisions live here; interlocks never read this file. The prod flag (Q7) lives in `registry.ts`                                         |

Like the firmware flasher's `resolveFirmwareFlashGate`, there is no Capacitor exemption. The prod flag of a tool is cleared in its own commit, after the owner has run the tool on a radio.

## How a tool joins

1. Add a registry entry (copy deck: what it does, what it costs, minutes, radios, `prodDisabled: true`).
2. Build its wizard as a page under `export/radio-tools/<tool>` with its own guarded send path; set `route` so the card shows **Start…**.
3. Say "nothing has changed" at every exit before the first write; offer a resumable recovery after it.
4. Clear `prodDisabled` in its own commit once checked on a radio.

## Related

- [README](README.md), [backup-restore.md](backup-restore.md), [adding-a-radio-adapter.md](adding-a-radio-adapter.md)
- Cards: [RadioIoPanelCards](../../../src/app/components/builds/RadioIoPanelCards/RadioIoPanelCards.md)
