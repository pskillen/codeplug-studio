# Export-smoke native YAML

Committed **native project YAML** used by the CPS wire export smoke ([#481](https://github.com/pskillen/codeplug-studio/issues/481)).

## Files

| File                | Role                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------- |
| `rich-project.yaml` | Representative library + radio builds/egress paths for each verifier-supported profile |

## Profiles under smoke

The fixture's `egressPaths[]` (each pointing at a `radioBuilds[]` row via `radioBuildId`) must include:

| `formatId` | `profileId`           |
| ---------- | --------------------- |
| `anytone`  | `anytone-at-d890uv`   |
| `dm32`     | `dm32-baofeng-dm32uv` |
| `opengd77` | `opengd77-1701`       |
| `chirp`    | `chirp-uv5r`          |
| `chirp`    | `chirp-uv21`          |
| `chirp`    | `chirp-rt95`          |

## Privacy

Prefer public repeater / talk-group data. Do not commit personal tokens, OAuth secrets, or private contact lists. Review before expanding this file.

## How CI uses it

`cps-verify/tests/export-smoke.test.ts` parses this YAML, exports via `exportBuildZip` / `exportBuildSingleFile` (same core path as Download ZIP), then runs `verifyCodeplug` on the ZIP or CSV. See [wire-verification.md](../../docs/build/testing/wire-verification.md).

## Expanding the fixture

Edit `rich-project.yaml` in Studio (import → adjust library/builds → export native YAML) or by hand, then re-run:

```bash
npm run test:cps-verify
```

Keep multi-zone / scan / expansion-friendly entities when adding coverage for [#482](https://github.com/pskillen/codeplug-studio/issues/482) content projection later.
