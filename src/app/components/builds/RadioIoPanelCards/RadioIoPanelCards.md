# RadioIoPanelCards

## Purpose

The small cards of the Export page's Web Serial panel ([`BuildRadioIoPanel`](../BuildRadioIoPanel.md)), organised around one primary action, **Write radio…** (#1393, workflow design §2.1). Each card is presentational; the panel decides which ones apply to the radio.

## Components

| Component                 | Shown when                                        | Props                                                            | What it shows                                                                                                                                                                                                                      |
| ------------------------- | ------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WriteHeaderCard`         | Always                                            | `radioLabel`, `summary?`, `disabled?`, `writeHidden?`, `onWrite` | "Write to <radio>", the primary **Write radio…** button, and a one-line summary ("412 channels · 18 zones · 3 radio-setting changes"; `buildSummaryLine` in `radioIoPanelFacts.ts`)                                                |
| `BeforeYouWriteRows`      | A channel is out of range, or the radio is a D890 | `radioLabel`, `outOfRangeNames`, `txRangeInfo?`                  | Only the rows that apply: "N channels are outside the <radio>'s receive range and won't be written" with **Show** for the names; the D890 transmit-limits line                                                                     |
| `AtD890RadioSettingsCard` | AT-D890UV                                         | `buildId`, `egress`                                              | "N changes this session · read from <name>" or "Your radios keep their own settings"; **Edit settings** (to the settings page) and **Read a radio**                                                                                |
| `RadioBackupCard`         | The descriptor supports backup                    | `buildId`                                                        | "Last backup this session: <time> (<name>)" or "No backups this session"; **Back up a radio** and a **Backup / Restore** link (both open the Backup page)                                                                          |
| `DangerZoneCard`          | AT-D890UV, and the Danger zone area is offered    | `buildId`                                                        | Last card: collapsed, red left edge, "Danger zone · Changes the radio itself"; open: "Rare jobs that change the radio, not your codeplug. Each one backs up first." and **Open danger zone** (to `/builds/:id/export/danger-zone`) |
| `ExperimentalNote`        | Always                                            | `details?`                                                       | One line "Web Serial is experimental…" with a **Details** link that opens the full warning and `details`                                                                                                                           |

## Usage

```tsx
<WriteHeaderCard radioLabel="AT-D890UV" summary="412 channels · 18 zones" onWrite={open} />
<BeforeYouWriteRows radioLabel="AT-D890UV" outOfRangeNames={names} txRangeInfo />
<AtD890RadioSettingsCard buildId={build.id} egress={egress} />
<RadioBackupCard buildId={build.id} />
```

## Behaviour

- One primary button on the panel: Write radio…. Card actions are secondary.
- **Read a radio** is the settings page's read ([`AtD890RadioSettingsReadButton`](../AtD890RadioSettingsEditor.md)); the result fills the session store, so the card and the settings page agree.
- The backup line reads `radioSessionBackups.ts` (per tab, in memory, cleared by a reload). Serials are shown in full.
- Must render under a router (the cards navigate).

## Related

- [radio-read-write hub](../../../../docs/features/radio-read-write/README.md), [backup-restore.md](../../../../docs/features/radio-read-write/backup-restore.md)
