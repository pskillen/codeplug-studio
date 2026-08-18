# Errands — two-way handovers

One file per dispatched piece of work. An errand is a **round trip**: the coordinator writes the brief, the assignee executes and writes the report into the same file.

Naming: `NN-slug.md`, zero-padded, allocated in order. Never renumber — findings and ledger rows cite errand ids.

---

## Index

| #   | Errand                                                | Assignee            | Status  | Returns                        |
| --- | ----------------------------------------------------- | ------------------- | ------- | ------------------------------ |
| E1  | CPS-written channel record dump                       | operator (hardware) | `draft` | 56-byte record + known lat/lon |
| E2  | Read firmware `latLon*` / channel-distance conversion | agent               | `draft` | confirm F20 or reopen encoding |

Status values: `draft` · `dispatched` · `returned` · `accepted` · `abandoned`.
`returned` means the report is written; `accepted` means the coordinator has folded the results into the ledger and findings.

## Rules

- Briefs are self-contained. The assignee has not read this directory.
- Briefs are immutable once dispatched. Wrong brief → new file, do not edit.
- State what a negative result looks like. A dump that matches qDMR is success; a dump that does not is also success (it kills F16).
- Assignees write only the Report section. Coordinator folds into `01` / `02` / `03`.
