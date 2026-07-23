# Profiles and export limits on radio builds

A **radio build** is keyed by catalog `radioTargetId`. Compatible **egress pathways** carry `formatId` / `profileId` (CHIRP, NeonPlug, OpenGD77, …).

| Concern                                              | Source of truth                                      |
| ---------------------------------------------------- | ---------------------------------------------------- |
| Organisation / Export **projection** UI visibility   | Catalog `RadioTarget.traits` for `radioTargetId`     |
| Unset `exportSettings` fill-ins on Export             | Catalog **default** compatible egress format defaults |
| Wire limits, ladders, retain, download/write chrome   | **Active egress** profile (or catalog default)       |

## When radios and profiles are chosen

| Workflow               | Where                                                    | Persisted?                                                                 |
| ---------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| New build              | `/builds/new` — **radio target** → name                  | Yes — `RadioBuild.radioTargetId`; all compatible `EgressPath` rows seeded  |
| Export pathway         | `/builds/:id/export` — egress switcher                   | Active selection in session + `defaultEgressPathId` on the build           |
| CHIRP runtime override | Export panel `ProfilePicker` when active egress is CHIRP | Session / export options only (does not rewrite seeded egress `profileId`) |

Changing the preferred pathway on Export updates `defaultEgressPathId` so the next session restores it. Switching pathways must **not** change which projection settings appear ([#658](https://github.com/pskillen/codeplug-studio/issues/658)).

## Operator-facing characteristics

**Radio characteristics** (`/builds/:id/characteristics`) is the read-only place operators see:

- How this **radio target** organises the build (zones, scan behaviour, expansion, …)
- Export limits for the **active egress** profile (entity counts, member caps, name lengths)
- Power ladder (and sibling ladders such as DM32 squelch)

Copy lives in [`buildCapabilityCopy.ts`](../../../src/app/lib/buildCapabilityCopy.ts). Limits are projected by [`getProfileExportLimits`](../../../src/core/import-export/profileExportLimits.ts).

## OpenGD77 / multi-variant radios

Catalog entries such as Baofeng DM-1701 vs MD-9600 are **separate radio targets**, each with its own OpenGD77 egress profile. See [import-export/opengd77](../import-export/opengd77/README.md).

## Component

[`ProfilePicker`](../../../src/app/components/builds/ProfilePicker.tsx) — used on Export for CHIRP runtime profile override (limits/filename). New build uses the radio-target catalog, not this picker.

## Related

- [builds README](README.md)
- [data-model](../data-model/README.md) — `RadioBuild` / `EgressPath`
- [DESIGN.md](../../../DESIGN.md) — build capability traits
- [#515](https://github.com/pskillen/codeplug-studio/issues/515) — Radio characteristics page
- [#654](https://github.com/pskillen/codeplug-studio/issues/654) — RadioBuild + EgressPath
- [#658](https://github.com/pskillen/codeplug-studio/issues/658) — Export projection gated by radio target
