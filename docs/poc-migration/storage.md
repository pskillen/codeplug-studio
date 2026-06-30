# Browser persistence — planning notes

**Purpose:** Capture persistence intent for Codeplug Studio before Phase 1 implementation. **Not** a schema spec or task checklist — revisit when modelling stabilises and Phase 2 local persistence work begins.

**See also:** [DESIGN.md](../../DESIGN.md) (architecture, data model sketch), [epic-1-context.md](epic-1-context.md) (migration rationale). In the archived prototype, [codeplug-tool#177](https://github.com/pskillen/codeplug-tool/issues/177) tracks a similar cost-benefit question for fully normalised IndexedDB.

---

## Context

The archived [codeplug-tool](https://github.com/pskillen/codeplug-tool) stores projects as a versioned **LocalStorage JSON envelope** — each project embeds a full nested `Codeplug`. That hits the ~5 MB per-origin cap with multiple or large projects.

The prototype's planned IndexedDB step ([#32](https://github.com/pskillen/codeplug-tool/issues/32)) keeps the same shape: one row per project with the codeplug as a structured-clone JSON blob. That solves quota with minimal refactor and matches an in-memory graph the app already holds.

**Studio is different:**

- **No lift-and-shift** — no users, no operator data to migrate; we do not need to preserve the old envelope shape.
- **New product model** — library + format builds + trait-shaped layout, not a single `Codeplug` graph.
- **Clean boundary** — persistence belongs in `integrations/` behind a port; `core` owns domain logic either way.

We should **not** copy the prototype's single JSON blob. Per-entity IndexedDB rows are a **product requirement**, not an optimisation — see [Multi-tab editing](#multi-tab-editing-product-driver) below.

---

## Multi-tab editing (product driver)

Codeplug work is naturally **multi-surface**: operators open individual channels, zones, talk groups, and contacts in **separate browser tabs** while a list or map stays open elsewhere. Single-tab or whole-project locking is a poor fit.

**Intended concurrency model:** normalised **one row per editable entity** + **revision on write** (optimistic concurrency — reject or prompt when a `put` sees a stale revision).

| Tab editing           | Persisted row                           | Overlap with another tab?                                            |
| --------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| Channel A detail      | `channels/{id}`                         | No — different row from Channel B or Talk group T                    |
| Talk group T detail   | `talkGroups/{id}`                       | No                                                                   |
| Zone Z (build-scoped) | `zones/{id}` or build-scoped equivalent | No — if zones are first-class rows, not nested only in layout JSON   |
| Project list / map    | Read-mostly aggregate                   | No writes to entity rows — but must **refresh** when other tabs save |

Different entities → different rows → **no write collision** between tabs. That is the main win over a project JSON blob.

### Same entity, two tabs

Duplicate tab on the same channel is the remaining conflict case. Revision/rejection handles it: second save fails → show "this channel was changed elsewhere; reload or overwrite." Rare compared to the common pattern of one tab per entity.

### Aggregate views (list, map, home)

These tabs do not own an entity row; they show projections over many rows. They should **subscribe to changes** (`BroadcastChannel` + entity id, or IDB change notification) and patch local state when another tab saves — not reload the whole project.

### Build layout blobs — residual risk

If zone membership or scan lists live only inside a **build `layout` JSON blob**, two tabs editing **different zones** could still collide on the same blob row. Mitigation: treat build-scoped editable things (zones, scan lists, memory slots) as **their own rows** when the trait model supports it; keep layout JSON for non-row structure only. Revisit when trait layout stabilises (see open questions).

### Session working copy per tab

Each entity editor tab still holds a **working copy** of that entity (and maybe minimal project context) in memory. On save: validate in `core` → `put` one row with expected revision. Durable truth is IndexedDB; the tab does not need the full library in memory.

List/map tabs may hydrate a broader working set but should not debounce-save the whole graph.

### Approaches ruled out / deferred

| Approach                          | Verdict                                                     |
| --------------------------------- | ----------------------------------------------------------- |
| **Single-editor tab**             | **Ruled out** — conflicts with how operators work           |
| **Detect + reload whole project** | Fallback for aggregate views only, not entity editors       |
| **Per-entity revision**           | **Preferred** — matches entity-per-tab UX                   |
| **IDB-primary / local-first**     | Deferred unless revision + subscriptions prove insufficient |

---

## Recommended direction: entity rows + revision

Normalise **editable units** to IndexedDB rows. Pair with **optimistic revision** on every `put`. Defer only what the trait model has not settled yet.

| Layer                           | Persist as                                                                                   | Rationale                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Project envelope**            | Metadata row(s) — id, name, timestamps                                                       | Cheap project list; infrequent edits          |
| **Library entities**            | One row per channel, talk group, contact, RX group list, … (`projectId` + `id` + `revision`) | Matches entity detail tabs; isolated saves    |
| **Build records**               | Metadata per build (`formatId`, `profileId`, name, revision)                                 | One row per build                             |
| **Build-scoped editable units** | Prefer rows (zones, scan lists, …) when traits define them                                   | Avoid layout-blob collisions across zone tabs |
| **Build layout remainder**      | Structured JSON only for structure not yet modelled as rows                                  | Shrink over time as traits stabilise          |

**Concurrency:** each row carries a monotonic `revision` (or `updatedAt` + guard). Save succeeds only if stored revision matches load revision; otherwise reject and surface reload/overwrite in UI.

**Routing alignment:** deep-linked entity routes (`/…/channel/:id`, `/…/zone/:id`) should load one row, edit, save one row — not hydrate the full project.

### What we are not doing

- **Single project JSON blob** — last-write-wins across tabs; incompatible with multi-tab editing.
- **Single-tab lock** — ruled out for product reasons (see above).
- **Whole-library debounced save** — entity editors persist per row; bulk save only on import or explicit project operations.

### Deferred (not rejected)

- **Fully normalised trait internals** — until trait enum and layout union are settled; but any trait unit that gets its own editor tab should become a row early.
- **IDB-primary local-first stack** — only if revision + cross-tab notifications are not enough.

### Cross-cutting

- Import, export, and native YAML interchange stay **document-shaped** — assemble graph → serialise, or parse → bulk `put` many rows in a transaction.
- FK integrity and validation stay in `core` mutations; persistence enforces revision, not business rules.
- `integrations` exposes **`ProjectPersistence`** (and likely per-entity read/write helpers); `core` does not import IndexedDB APIs.

---

## Costs and other benefits

Costs to plan for (adapted from [codeplug-tool#177](https://github.com/pskillen/codeplug-tool/issues/177)):

| Area                  | Concern                                                                                |
| --------------------- | -------------------------------------------------------------------------------------- |
| **Model uncertainty** | Trait layout still evolving — row boundaries for build-scoped units may shift          |
| **Schema migration**  | `CODEPLUG_SCHEMA_VERSION` bumps may touch N stores                                     |
| **Import / delete**   | Bulk `put` in transactions; cascade delete when removing entities referenced elsewhere |
| **Interchange**       | YAML/CPS still needs assemble/disassemble — normalisation does not remove that         |

Benefits beyond multi-tab:

| Benefit                      | Notes                                                                  |
| ---------------------------- | ---------------------------------------------------------------------- |
| **Multi-tab entity editing** | **Primary driver** — one tab per channel/zone/TG without write overlap |
| **Smaller saves**            | Per-row `put` instead of rewriting a megabyte blob                     |
| **Boot / project list**      | Metadata-only load before pulling entity rows                          |
| **Cloud entity sync**        | Phase 3 — per-row revision aligns with delta upload/download           |
| **Quota**                    | IndexedDB vs LocalStorage; row model is not required for quota alone   |

---

## Phase alignment

| Phase | Persistence relevance                                                                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | Scaffold, core models, **`ProjectPersistence` port** in `integrations/`, envelope versioning strategy — implementation can be minimal or in-memory until models land |
| **2** | **Local persistence** — entity rows + revision; entity detail routes load/save one row; aggregate views subscribe to cross-tab changes                               |
| **3** | Native YAML + Google Drive — full-project serialisation; cloud is interchange, not the edit store (same pattern as prototype)                                        |

Update [DESIGN.md](../../DESIGN.md) architecture diagram (`localStorage envelope`) when persistence is implemented — it is a placeholder.

---

## Implementation notes (when the time comes)

Keep these constraints; defer store names, indexes, and Dexie vs raw IDB to the implementation slice.

1. **Port in `integrations/`** — `core` never imports IndexedDB APIs.
2. **Versioned schema** — envelope version + inner model schema version; migrations on load.
3. **Per-entity revision** — monotonic field on every persistable row; conditional `put` or explicit check before write.
4. **Entity-scoped save** — detail tabs persist one row; debounce within that entity only.
5. **Cross-tab notify** — `BroadcastChannel` (or equivalent) with `{ projectId, entityType, entityId }` so list/map tabs update without full reload.
6. **Import path** — bulk `put` in a transaction; assign fresh revisions.
7. **Privacy** — operator data stays in browser storage only; never in the repo.

---

## Decision log

| Date       | Decision                                                                                                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-06-29 | Hybrid persistence: normalised library entities, project/build metadata, trait layout as JSON per build until model stabilises. No prototype blob lift-and-shift; no full normalisation without measured need.                                                     |
| 2026-06-29 | Session vs durable store: in-memory working copy is default SPA pattern, not a rejection of IDB; multi-tab needs an explicit concurrency policy (undecided).                                                                                                       |
| 2026-06-29 | Multi-tab entity editing is a product driver: per-entity IDB rows + revision/rejection; single-tab lock ruled out. Build-scoped units that get editor tabs should be rows, not layout-blob-only.                                                                   |
| 2026-06-30 | Phase 2 (#9) implemented `IndexedDbProjectPersistence`: one object store per entity kind keyed by `[projectId, id]`, optimistic `revision` concurrency, and `BroadcastChannel` cross-tab change notifications. Build `layout` remains JSON until traits stabilise. |

---

## Open questions (resolve during Phase 1 modelling)

These affect persistence shape — do not finalise object stores until they are answered:

- Trait layout: discriminated union per trait vs optional sections on one object.
- Zones and RX group lists: library-global vs build-scoped.
- Whether m×n channel expansion is persistent build state or export-time projection only.
- Exact library entity set (e.g. whether `zones` live in library at all).
- **Build-scoped row boundaries** — which trait units (zones, scan lists, memory slots) are rows vs layout JSON, given multi-tab zone/build editors.
- **Delete while open elsewhere** — cascade + notify tabs holding deleted entity ids.

When trait layout settles, prefer rows over layout JSON for any unit that has its own editor route.
