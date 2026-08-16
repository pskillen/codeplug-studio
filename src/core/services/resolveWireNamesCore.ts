/**
 * Wire-name resolution core — the shared, format-agnostic policy engine behind
 * `resolveWireNames.ts`. Split into its own file so callers that only ever have
 * already-merged `CpsExportOptions` (CPS serialisers working from `AssembledBuild`, not a
 * `RadioBuild`) can depend on this file directly, without pulling in
 * `@core/import-export/exportSettingsMerge.ts` — which imports
 * `@core/import-export/registry.ts` for `getFormatExportDefaults`.
 *
 * That import chain matters: several CPS format packages (e.g. `formats/neonplug/`) are
 * *themselves* registered inside `registry.ts` (`registry.ts` → `formats/<format>/adapter.ts`
 * → `serialise.ts` → this resolver). If those in-package files imported
 * `resolveWireNames.ts` (which needs `exportSettingsMerge.ts` → `registry.ts` for its
 * build-based `resolveWireNames()` entry point), that closes a real ESM import cycle back
 * into `registry.ts` — which triggers module-initialisation corruption under Vitest's SSR
 * module graph (observed as an unrelated adapter's export silently becoming `undefined`,
 * e.g. `nativeYamlExportAdapter` in `adapterContract.test.ts`, after adding an unrelated,
 * even *unused*, import of `resolveWireNames.ts` to a `formats/neonplug/*.ts` file).
 * `resolveWireNamesFromOptions()` here never needed `mergeExportOptions` in the first
 * place (the caller already ran it) — the split just makes that already-true fact visible
 * to the module graph, so `formats/<format>/*.ts` callers can import this file directly and
 * never reach `registry.ts` at all.
 *
 * Vendor-neutral: this file must not import a format adapter or branch on
 * `formatId === 'anytone' | 'opengd77' | 'dm32' | 'chirp' | 'neonplug'`. Limits come from
 * {@link getProfileExportLimits}; format-specific *composition* stays in
 * `@core/import-export/formats/<format>/` and is not referenced here.
 */
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import type { BuildEntityOverride } from '@core/models/radioBuild.ts';
import { overrideByEntityId } from '@core/domain/formatBuildOverrides.ts';
import type {
  AnalogContact,
  Channel,
  DigitalContact,
  TalkGroup,
  Zone,
} from '@core/models/library.ts';
import type { RxGroupList, ScanList } from '@core/models/library.ts';
import type { AssembledBuild, LibrarySlice } from './assemble.ts';
import type { CpsExportOptions, FormatId } from '@core/import-export/types.ts';
import {
  getProfileExportLimits,
  profileNameLimit,
} from '@core/import-export/profileExportLimits.ts';
import {
  applyWireNameLimits,
  composeExportWireName,
} from '@core/import-export/channelExpansion/exportWireNames.ts';
import { applyListWireNameLimits } from '@core/import-export/channelExpansion/listWireNames.ts';
import { applyTalkGroupWireNameLimits } from '@core/import-export/channelExpansion/talkGroupWireNames.ts';
import {
  analogContactExportBaseName,
  applyDigitalContactExportWireName,
  DEFAULT_DIGITAL_CONTACT_EXPORT_NAME_MODE,
  digitalContactExportBaseName,
} from '@core/import-export/digitalContactExportName.ts';
import { uniqueWireName } from '@core/import-export/channelExpansion/shortenName.ts';
import { sanitiseAsciiWireString } from '@core/import-export/sanitiseAsciiWireString.ts';
import type { WireNameEntityKind as WireNameWarningEntityKind } from '@core/import-export/channelExpansion/wireNameWarning.ts';

/** Wire-name-bearing entity kinds this resolver supports. */
export type WireNameEntityKind =
  'channel' | 'zone' | 'scanList' | 'talkGroup' | 'contact' | 'rxGroupList';

export type WireNameRemediation =
  'none' | 'shortened' | 'disambiguated' | 'truncated' | 'over_limit';

export interface WireNameResolution {
  /** Stable key for override storage — library entity id (expansion rows: phase 2+). */
  key: string;
  libraryEntityId: string;
  entityKind: WireNameEntityKind;
  libraryName: string;
  /** Pure generated candidate — never sees this row's own override. */
  suggestion: string;
  override?: string;
  /** `override ?? suggestion`, limits re-applied per whether this row is an override. */
  effective: string;
  limit?: number;
  remediation: WireNameRemediation;
}

const WARNING_LABEL_BY_KIND: Record<WireNameEntityKind, WireNameWarningEntityKind> = {
  channel: 'Channel',
  zone: 'Zone',
  scanList: 'Scan list',
  talkGroup: 'Talk group',
  contact: 'Contact',
  rxGroupList: 'RX group list',
};

/** `profileNameLimit` kind for each resolver entity kind — same shape, different name. */
const LIMIT_KIND_BY_ENTITY_KIND: Record<
  WireNameEntityKind,
  'channel' | 'zone' | 'contact' | 'talkGroup' | 'scanList' | 'rxGroupList'
> = {
  channel: 'channel',
  zone: 'zone',
  scanList: 'scanList',
  talkGroup: 'talkGroup',
  contact: 'contact',
  rxGroupList: 'rxGroupList',
};

/**
 * `resolveWireNamesFromOptions` input — already-merged `CpsExportOptions` and a per-kind
 * override array, for callers that don't hold the original `RadioBuild` (CPS serialisers
 * work from `AssembledBuild` + already-merged export options — see `resolveWireNames.ts`
 * for the build-based sibling entry point).
 */
export interface ResolveWireNamesFromOptionsArgs {
  library: LibrarySlice;
  entityKind: WireNameEntityKind;
  formatId: string;
  profileId?: string;
  options: CpsExportOptions;
  overrides?: readonly BuildEntityOverride[];
}

interface CandidateEntity {
  id: string;
  libraryName: string;
  rawBase: string;
}

/**
 * Classify what (if anything) had to be done to fit `resolved` within `limit`.
 * Exported (not just used internally) so `'over_limit'` — unreachable via the lifted
 * shorten/truncate primitives today, which always hard-slice to fit once a numeric
 * limit is set — is still directly testable pending a primitive that can genuinely fail
 * to fit (e.g. a fixed/protected suffix wider than the whole budget).
 */
export function classifyWireNameRemediation(params: {
  original: string;
  resolved: string;
  limit: number | null;
  isOverride: boolean;
}): WireNameRemediation {
  const original = params.original.trim();
  const resolved = params.resolved;

  if (params.limit == null) {
    return resolved !== original ? 'disambiguated' : 'none';
  }

  const originalFits = original.length <= params.limit;
  if (originalFits) {
    return resolved === original ? 'none' : 'disambiguated';
  }

  const resolvedFits = resolved.length <= params.limit;
  if (!resolvedFits) return 'over_limit';
  return params.isOverride ? 'truncated' : 'shortened';
}

/**
 * Apply the profile limit (or pass through when unmodelled) to one candidate name,
 * reusing the existing lift-don't-rewrite shorten/uniquify primitives per entity kind.
 */
function resolveNameForKind(
  entityKind: WireNameEntityKind,
  base: string,
  isOverride: boolean,
  reserved: Set<string>,
  limit: number | null,
  entity: CandidateEntityWithSource,
  options: CpsExportOptions,
  profileId: string | undefined,
): string {
  const warnings: ExportWarning[] = [];

  if (limit == null) {
    // Unmodelled — pass through, dedupe only (no cap to enforce).
    const name = sanitiseAsciiWireString(uniqueWireName(base.trim(), reserved));
    reserved.add(name);
    return name;
  }

  switch (entityKind) {
    case 'channel':
      return applyWireNameLimits(
        base,
        entity.channel!,
        reserved,
        { ...options, maxNameLength: limit },
        profileId,
        warnings,
        true,
        isOverride,
      );
    case 'zone':
    case 'scanList':
    case 'rxGroupList':
      return applyListWireNameLimits(
        base,
        reserved,
        options,
        profileId,
        warnings,
        WARNING_LABEL_BY_KIND[entityKind],
        limit,
        isOverride,
      );
    case 'talkGroup':
      return applyTalkGroupWireNameLimits(
        base,
        entity.talkGroup!,
        reserved,
        options,
        profileId,
        warnings,
        limit,
        isOverride,
      );
    case 'contact':
      return applyDigitalContactExportWireName(
        base,
        { ...options, maxNameLength: limit },
        profileId,
        warnings,
        isOverride,
      );
  }
}

interface CandidateEntityWithSource extends CandidateEntity {
  channel?: Channel;
  talkGroup?: TalkGroup;
}

function candidatesForKind(
  entityKind: WireNameEntityKind,
  library: LibrarySlice,
  options: CpsExportOptions,
): CandidateEntityWithSource[] {
  switch (entityKind) {
    case 'channel':
      return library.channels.map((channel) => ({
        id: channel.id,
        libraryName: channel.name,
        rawBase: composeExportWireName(channel, options),
        channel,
      }));
    case 'zone':
      return library.zones.map((zone: Zone) => ({
        id: zone.id,
        libraryName: zone.name,
        rawBase: zone.name,
      }));
    case 'scanList':
      return library.scanLists.map((scanList: ScanList) => ({
        id: scanList.id,
        libraryName: scanList.name,
        rawBase: scanList.name,
      }));
    case 'rxGroupList':
      return library.rxGroupLists.map((list: RxGroupList) => ({
        id: list.id,
        libraryName: list.name,
        rawBase: list.name,
      }));
    case 'talkGroup':
      return library.talkGroups.map((talkGroup: TalkGroup) => ({
        id: talkGroup.id,
        libraryName: talkGroup.name,
        rawBase: talkGroup.name,
        talkGroup,
      }));
    case 'contact': {
      const mode = options.digitalContactExportNameMode ?? DEFAULT_DIGITAL_CONTACT_EXPORT_NAME_MODE;
      const digital = library.digitalContacts.map((contact: DigitalContact) => ({
        id: contact.id,
        libraryName: contact.name,
        rawBase: digitalContactExportBaseName(contact, mode),
      }));
      const analog = library.analogContacts.map((contact: AnalogContact) => ({
        id: contact.id,
        libraryName: contact.name,
        rawBase: analogContactExportBaseName(contact),
      }));
      return [...digital, ...analog];
    }
  }
}

/**
 * Resolve wire names for every library entity of one kind under one format/profile, given
 * already-merged export options and a per-kind override array. Pure with respect to each
 * row's own override (`suggestion` never sees it); `effective` folds `override ?? suggestion`
 * and re-applies limits per whether this row is an override (hard-truncate policy) or a
 * generated suggestion (smart-shorten policy).
 *
 * `resolveWireNames()` (the build-based sibling in `resolveWireNames.ts`) is a thin wrapper
 * around this same function — it just derives `options`/`overrides` from a `RadioBuild`
 * first via `mergeExportOptions`.
 */
export function resolveWireNamesFromOptions(
  args: ResolveWireNamesFromOptionsArgs,
): WireNameResolution[] {
  const { library, entityKind, formatId, profileId, options } = args;

  const limits = getProfileExportLimits(formatId as FormatId, profileId ?? '');
  const limitValue = limits
    ? profileNameLimit(limits, LIMIT_KIND_BY_ENTITY_KIND[entityKind])
    : null;
  if (limitValue === 'not_used') return [];
  const limit = typeof limitValue === 'number' ? limitValue : null;

  const overrides = overrideByEntityId(args.overrides);

  const candidates = candidatesForKind(entityKind, library, options);
  const reservedForEffective = new Set<string>();
  const results: WireNameResolution[] = [];

  for (const candidate of candidates) {
    const overrideRaw = overrides.get(candidate.id)?.wireName?.trim();
    const isOverride = Boolean(overrideRaw);

    const dryReserved = new Set(reservedForEffective);
    const suggestion = resolveNameForKind(
      entityKind,
      candidate.rawBase,
      false,
      dryReserved,
      limit,
      candidate,
      options,
      profileId,
    );

    const effectiveBase = isOverride ? overrideRaw! : candidate.rawBase;
    const effective = resolveNameForKind(
      entityKind,
      effectiveBase,
      isOverride,
      reservedForEffective,
      limit,
      candidate,
      options,
      profileId,
    );

    const remediation = classifyWireNameRemediation({
      original: effectiveBase,
      resolved: effective,
      limit,
      isOverride,
    });

    results.push({
      key: candidate.id,
      libraryEntityId: candidate.id,
      entityKind,
      libraryName: candidate.libraryName,
      suggestion,
      override: overrideRaw,
      effective,
      ...(limit != null ? { limit } : {}),
      remediation,
    });
  }

  return results;
}

/**
 * Reconstruct a minimal override array from assembled rows' `wireNameOverride` — for CPS
 * serialisers that only have `AssembledBuild` (already override-folded per row by
 * `assemble()`), not the raw `RadioBuild.<kind>Overrides` array `resolveWireNames` reads.
 * Only entity kinds without a dedicated array on `CpsExportOptions` (zone, scanList,
 * talkGroup, rxGroupList) need this — channel/contact overrides already travel on
 * `CpsExportOptions.channelOverrides` / `.contactOverrides`.
 */
export function overridesFromAssembledWireNames<T extends { wireNameOverride?: string }>(
  rows: readonly T[],
  idOf: (row: T) => string,
): BuildEntityOverride[] {
  const overrides: BuildEntityOverride[] = [];
  for (const row of rows) {
    const wireName = row.wireNameOverride?.trim();
    if (wireName) overrides.push({ libraryEntityId: idOf(row), wireName });
  }
  return overrides;
}

/**
 * `AssembledBuild.library` is set by `exportBuild.ts` on every real export pass (so
 * `resolveWireNamesFromOptions` gets the real library there), but some callers construct
 * `AssembledBuild` directly via `assemble()` without it (unit tests, and a couple of
 * back-compat entry points that serialise a single CPS file standalone). This reconstructs
 * a best-effort `LibrarySlice` from the assembled rows for that case.
 *
 * Zone/scan-list stubs use `wireName` (override-or-raw, per `resolveOverrideWireName` —
 * not yet shortened/uniquified) as `.name` since `AssembledZone`/`AssembledScanList` don't
 * retain a separate pre-override library name. This only affects the resolver's `suggestion`
 * output for rows that already carry an override — serialisers only ever read `.effective`
 * (which correctly prefers the override either way), so it's harmless in practice.
 */
export function libraryFromAssembledOrStub(assembled: AssembledBuild): LibrarySlice {
  if (assembled.library) return assembled.library;
  return {
    channels: assembled.channels.map((row) => row.entity),
    zones: assembled.zones.map(
      (row) => ({ id: row.zoneId, name: row.wireName, members: [], comment: '' }) as Zone,
    ),
    talkGroups: assembled.talkGroups.map((row) => row.entity),
    digitalContacts: assembled.digitalContacts.map((row) => row.entity),
    analogContacts: assembled.analogContacts.map((row) => row.entity),
    rxGroupLists: assembled.rxGroupLists.map((row) => row.entity),
    scanLists: assembled.scanLists.map(
      (row) =>
        ({
          id: row.scanListId,
          name: row.wireName,
          memberChannelIds: row.memberChannelIds,
        }) as ScanList,
    ),
  };
}
