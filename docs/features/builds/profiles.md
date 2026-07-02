# Radio profiles on builds

Operators pick a **radio profile** when creating a format build. The profile defines which capability traits apply and which wire limits the export adapter enforces at the CPS boundary.

## When profiles are chosen

| Workflow | Where | Persisted? |
| --- | --- | --- |
| New build | `/builds/new` — format → **profile** → name | Yes — stored on `FormatBuild.profileId` |
| Build detail | Target section — `ProfilePicker` (select mode) | Yes — after **Save** |
| CPS export | Export panel — export profile override | No — export-time only unless saved on Target |

## OpenGD77 profiles

OpenGD77 has multiple **radio variants** (e.g. Baofeng 1701, MD9600) with different channel caps, zone member limits, and 16-character wire name limits. See [import-export/opengd77](../import-export/opengd77/README.md) for profile vs trait profile.

## Changing profile on an existing build

If the build already has layout sections or entity selections, Studio asks for confirmation before changing profile — limits may differ between variants.

## Component

[`ProfilePicker`](../../../src/app/components/builds/ProfilePicker.tsx) — card list for new-build wizard; dropdown for detail and export override.

## Related

- [builds README](README.md)
- [data-model](../data-model/README.md) — `FormatBuild.profileId`
- [DESIGN.md](../../../DESIGN.md) — build capability traits
