# Radio profiles on builds

Operators pick a **radio profile** when creating a format build. The profile defines which organisation capabilities apply and which wire limits the export adapter enforces at the CPS boundary.

## When profiles are chosen

| Workflow     | Where                                          | Persisted?                              |
| ------------ | ---------------------------------------------- | --------------------------------------- |
| New build    | `/builds/new` — format → **profile** → name    | Yes — stored on `FormatBuild.profileId` |
| Build detail | Target section — `ProfilePicker` (select mode) | Yes — after **Save**                    |

Change profile in **Target** before exporting — export uses the saved build `profileId`.

## Operator-facing characteristics

**Radio characteristics** (`/builds/:id/characteristics`) is the read-only place operators see:

- How this profile organises the build (zones, scan behaviour, expansion, …)
- Export limits (entity counts, member caps, name lengths) — known figures from `formats/*/profiles.ts`, blanks where not yet modelled
- Power ladder (and sibling ladders such as DM32 squelch)

Copy lives in [`buildCapabilityCopy.ts`](../../../src/app/lib/buildCapabilityCopy.ts). Limits are projected by [`getProfileExportLimits`](../../../src/core/import-export/profileExportLimits.ts) — per-format profile types stay separate; the projection only normalises for UI.

Overview links here from the organisation badges section. Deeper overview / new-build hints remain under [#259](https://github.com/pskillen/codeplug-studio/issues/259).

## OpenGD77 profiles

OpenGD77 has multiple **radio variants** (e.g. Baofeng 1701, MD9600) with different channel caps, zone member limits, and 16-character wire name limits. See [import-export/opengd77](../import-export/opengd77/README.md) for profile vs trait profile.

## Changing profile on an existing build

If the build already has layout sections or entity selections, Studio asks for confirmation before changing profile — limits may differ between variants. After save, **Radio characteristics** reflects the new `profileId`.

## Component

[`ProfilePicker`](../../../src/app/components/builds/ProfilePicker.tsx) — card list for new-build wizard; dropdown on build detail Target section.

## Related

- [builds README](README.md)
- [data-model](../data-model/README.md) — `FormatBuild.profileId`
- [DESIGN.md](../../../DESIGN.md) — build capability traits
- [#515](https://github.com/pskillen/codeplug-studio/issues/515) — Radio characteristics page
