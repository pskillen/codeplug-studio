# Approval policy — Cursor boundary rules

**Always require human review.** Do not auto-approve PRs that change constitutional boundary rules in this directory.

## Scope

Changes to always-applied or architecture-critical rules:

- [`layer-boundaries.mdc`](layer-boundaries.mdc) — core / integrations / app dependency direction
- [`vendor-boundaries.mdc`](vendor-boundaries.mdc) — vendor-neutral internal model, UUID FKs
- [`library-and-builds.mdc`](library-and-builds.mdc) — library vs persisted build layout
- [`documentation-boundaries.mdc`](documentation-boundaries.mdc) — tier 1 / 2 / 3 doc boundaries
- [`format-agnostic-docs.mdc`](format-agnostic-docs.mdc) — format-agnostic wording in generic docs
- [`documentation-deliverables.mdc`](documentation-deliverables.mdc) — docs ship with behaviour
- [`export-from-model.mdc`](export-from-model.mdc) — no wire stash on export

## Rationale

These files define the internal model, layer direction, and documentation tiers. A mistaken merge propagates to every future agent session.

## Out of scope for this policy

Changes to `.cursor/skills/**` and non-boundary rules inherit the root [`APPROVAL_POLICY.md`](../../APPROVAL_POLICY.md) permissive default.

## Auto-approve

Never auto-approve changes to the boundary rules listed above, regardless of CI status on the PR.
