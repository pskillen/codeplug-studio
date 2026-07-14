# Approval policy — Cursor approval governance

**Always require human review.** Do not auto-approve PRs that change files in this directory.

## Scope

Changes to approval and routing policy files:

- [`ROUTING.md`](ROUTING.md) — product boundary routing for the Approval Agent
- Any nested `APPROVAL_POLICY.md` referenced from routing

## Rationale

Governance files control when the Approval Agent may auto-approve. Cursor uses the base-branch version when a PR edits these files, but explicit human review is still required.

## Auto-approve

Never auto-approve changes under `.cursor/approval-policies/` regardless of CI status on the PR.
