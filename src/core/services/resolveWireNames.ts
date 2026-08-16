/**
 * Single wire-name resolution service — one function that answers "what will be
 * written for this row, why, and what damage was needed" for every wire-name-bearing
 * entity kind (channel, zone, scan list, talk group, contact, RX group list).
 *
 * The actual policy engine lives in `resolveWireNamesCore.ts` — this file adds the
 * build-based entry point (`resolveWireNames`, for `previewWireRows` / `radioIo*.ts`, both
 * of which hold the original `RadioBuild`) on top of it, and re-exports everything else for
 * convenience. CPS serialisers (`formats/<format>/serialise.ts`) work from `AssembledBuild`
 * + already-merged options instead, so they call `resolveWireNamesFromOptions` — and
 * **must import it from `./resolveWireNamesCore.ts` directly, not from this file**, if the
 * calling module is itself part of a format package that's registered in
 * `@core/import-export/registry.ts` (e.g. `formats/neonplug/*.ts`). This file pulls in
 * `mergeExportOptions` from `@core/import-export/exportSettingsMerge.ts`, which imports
 * `registry.ts` — closing a real cycle back through that format's own `adapter.ts` that
 * corrupts Vitest's SSR module graph. See the longer note atop `resolveWireNamesCore.ts`.
 *
 * Vendor-neutral: this file must not import a format adapter or branch on
 * `formatId === 'anytone' | 'opengd77' | 'dm32' | 'chirp' | 'neonplug'`. Limits come
 * from {@link getProfileExportLimits}; format-specific *composition* stays in
 * `@core/import-export/formats/<format>/` and is not referenced here.
 */
import type { BuildEntityOverride, RadioBuild } from '@core/models/radioBuild.ts';
import type { OverrideField } from '@core/domain/formatBuildOverrides.ts';
import type { LibrarySlice } from './assemble.ts';
import { mergeExportOptions } from '@core/import-export/exportSettingsMerge.ts';
import {
  resolveWireNamesFromOptions,
  type WireNameEntityKind,
  type WireNameResolution,
} from './resolveWireNamesCore.ts';

export type {
  WireNameEntityKind,
  WireNameRemediation,
  WireNameResolution,
  ResolveWireNamesFromOptionsArgs,
} from './resolveWireNamesCore.ts';
export {
  classifyWireNameRemediation,
  resolveWireNamesFromOptions,
  overridesFromAssembledWireNames,
  libraryFromAssembledOrStub,
} from './resolveWireNamesCore.ts';

const OVERRIDE_FIELD_BY_KIND: Record<WireNameEntityKind, OverrideField> = {
  channel: 'channelOverrides',
  zone: 'zoneOverrides',
  scanList: 'scanListOverrides',
  talkGroup: 'talkGroupOverrides',
  contact: 'contactOverrides',
  rxGroupList: 'rxGroupListOverrides',
};

export interface ResolveWireNamesArgs {
  build: RadioBuild;
  library: LibrarySlice;
  entityKind: WireNameEntityKind;
  formatId: string;
  profileId?: string;
}

/**
 * Resolve wire names for every library entity of one kind under one build/format/profile.
 * Pure with respect to each row's own override — `suggestion` never sees it. `effective`
 * folds `override ?? suggestion` and re-applies limits per whether this row is an override
 * (hard-truncate policy) or a generated suggestion (smart-shorten policy).
 */
export function resolveWireNames(args: ResolveWireNamesArgs): WireNameResolution[] {
  const { build, library, entityKind, formatId, profileId } = args;
  const options = mergeExportOptions(build, formatId, { profileId }, library);
  const overrideField = OVERRIDE_FIELD_BY_KIND[entityKind];
  const overrides = build[overrideField] as readonly BuildEntityOverride[] | undefined;
  return resolveWireNamesFromOptions({
    library,
    entityKind,
    formatId,
    profileId,
    options,
    overrides,
  });
}
