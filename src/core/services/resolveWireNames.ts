/**
 * Single wire-name resolution service — one function that answers "what will be
 * written for this row, why, and what damage was needed" for every wire-name-bearing
 * entity kind (channel, zone, scan list, talk group, contact, RX group list).
 *
 * Vendor-neutral: this file must not import a format adapter or branch on
 * `formatId === 'anytone' | 'opengd77' | 'dm32' | 'chirp' | 'neonplug'`. Limits come
 * from {@link getProfileExportLimits}; format-specific *composition* stays in
 * `@core/import-export/formats/<format>/` and is not referenced here.
 *
 * Not yet the live path — `previewWireRows`, format serialisers, and `radioIo*.ts`
 * still compute names independently (phase 2 of the wire-preview rework repoints them).
 */
import type { BuildEntityOverride, RadioBuild } from '@core/models/radioBuild.ts';
import type { OverrideField } from '@core/domain/formatBuildOverrides.ts';
import { overrideByEntityId } from '@core/domain/formatBuildOverrides.ts';
import type {
  AnalogContact,
  Channel,
  DigitalContact,
  TalkGroup,
  Zone,
} from '@core/models/library.ts';
import type { RxGroupList, ScanList } from '@core/models/library.ts';
import type { LibrarySlice } from './assemble.ts';
import type { FormatId } from '@core/import-export/types.ts';
import {
  getProfileExportLimits,
  profileNameLimit,
} from '@core/import-export/profileExportLimits.ts';
import { mergeExportOptions } from '@core/import-export/exportSettingsMerge.ts';
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

const OVERRIDE_FIELD_BY_KIND: Record<WireNameEntityKind, OverrideField> = {
  channel: 'channelOverrides',
  zone: 'zoneOverrides',
  scanList: 'scanListOverrides',
  talkGroup: 'talkGroupOverrides',
  contact: 'contactOverrides',
  rxGroupList: 'rxGroupListOverrides',
};

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

export interface ResolveWireNamesArgs {
  build: RadioBuild;
  library: LibrarySlice;
  entityKind: WireNameEntityKind;
  formatId: string;
  profileId?: string;
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
  options: ReturnType<typeof mergeExportOptions>,
  profileId: string | undefined,
): string {
  const warnings: string[] = [];

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
  options: ReturnType<typeof mergeExportOptions>,
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
 * Resolve wire names for every library entity of one kind under one build/format/profile.
 * Pure with respect to each row's own override — `suggestion` never sees it. `effective`
 * folds `override ?? suggestion` and re-applies limits per whether this row is an override
 * (hard-truncate policy) or a generated suggestion (smart-shorten policy).
 */
export function resolveWireNames(args: ResolveWireNamesArgs): WireNameResolution[] {
  const { build, library, entityKind, formatId, profileId } = args;
  const options = mergeExportOptions(build, formatId, { profileId }, library);

  const limits = getProfileExportLimits(formatId as FormatId, profileId ?? '');
  const limitValue = limits
    ? profileNameLimit(limits, LIMIT_KIND_BY_ENTITY_KIND[entityKind])
    : null;
  if (limitValue === 'not_used') return [];
  const limit = typeof limitValue === 'number' ? limitValue : null;

  const overrideField = OVERRIDE_FIELD_BY_KIND[entityKind];
  const overrides = overrideByEntityId(
    build[overrideField] as readonly BuildEntityOverride[] | undefined,
  );

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
