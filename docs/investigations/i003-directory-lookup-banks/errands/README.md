# Errands — two-way handovers

One file per dispatched piece of work. An errand is a **round trip**: the coordinator writes the brief, the assignee executes and writes the report into the same file.

Naming: `NN-slug.md`, zero-padded, allocated in order. Never renumber — findings and ledger rows cite errand ids.

---

## Index

| #   | Errand                                                | Assignee            | Status       | Returns                                          |
| --- | ----------------------------------------------------- | ------------------- | ------------ | ------------------------------------------------ |
| E1  | MD-9600 User Database Write, then silent-repeater LCD | operator (hardware) | `dispatched` | Backup inspect occupancy + LCD on a known DMR ID |

Status values: `draft` · `dispatched` · `returned` · `accepted` · `abandoned`.
`returned` means the report is written; `accepted` means the coordinator has folded the results into the ledger and findings.

## Rules

- Briefs are self-contained. The assignee has not read this directory.
- Briefs are immutable once dispatched. Wrong brief → new file, do not edit.
- State what a negative result looks like. Occupied FLASH with a still-blank LCD is the answer, not a failed errand.
- Assignees write only the Report section. Coordinator folds into `01` / `02` / `03`.
