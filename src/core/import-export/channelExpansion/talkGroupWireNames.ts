import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import type { TalkGroup } from '@core/models/library.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { finalizeWireName, hardTruncateUniqueWireName, uniqueWireName } from './shortenName.ts';
import { sanitiseAsciiWireString } from '../sanitiseAsciiWireString.ts';
import { resolveMaxNameLength } from './exportWireNames.ts';
import { pushWireNameCollisionWarning, pushWireNameLengthWarning } from './wireNameWarning.ts';

export type TalkGroupWireNameMap = ReadonlyMap<string, string>;

/**
 * Resolve one talk-group wire name for CPS export (Contacts.csv / FK columns).
 * When the base name exceeds the profile limit, prefer `TalkGroup.abbreviation`
 * (when enabled) then the shared shortening pipeline.
 */
export function applyTalkGroupWireNameLimits(
  baseWireName: string,
  talkGroup: TalkGroup,
  reserved: Set<string>,
  options: CpsExportOptions | undefined,
  profileId: string | undefined,
  warnings: ExportWarning[],
  /** Override profile `nameLimit` (e.g. radio-io talk-group field width). */
  maxLenOverride?: number,
  isOverride = false,
): string {
  const maxLen = maxLenOverride ?? resolveMaxNameLength(profileId ?? options?.profileId, options);
  const shorten = options?.shortenNames !== false;
  const original = baseWireName.trim();
  let base = original;

  if (isOverride || !shorten || maxLen == null) {
    if (isOverride && maxLen != null) {
      const {
        name: truncated,
        collided,
        stem,
      } = hardTruncateUniqueWireName(base, reserved, maxLen, true);
      const name = sanitiseAsciiWireString(truncated);
      if (collided) {
        pushWireNameCollisionWarning(warnings, {
          entityKind: 'Talk group',
          candidate: stem,
          disambiguated: name,
        });
      }
      pushWireNameLengthWarning(warnings, {
        entityKind: 'Talk group',
        original,
        exported: name,
        maxLen,
        profileId: profileId ?? options?.profileId,
        shortenEnabled: false,
      });
      return name;
    }

    const uniquified = uniqueWireName(base, reserved);
    const name = sanitiseAsciiWireString(uniquified);
    reserved.add(name);
    pushWireNameCollisionWarning(warnings, {
      entityKind: 'Talk group',
      candidate: base,
      disambiguated: name,
    });
    if (maxLen != null) {
      pushWireNameLengthWarning(warnings, {
        entityKind: 'Talk group',
        original,
        exported: name,
        maxLen,
        profileId: profileId ?? options?.profileId,
        shortenEnabled: false,
      });
    }
    return name;
  }

  const abbrev = talkGroup.abbreviation?.trim();
  if (base.length > maxLen && abbrev && options?.useTalkGroupAbbreviation !== false) {
    base = abbrev;
  }

  const {
    name: finalized,
    collided,
    stem,
  } = finalizeWireName(base, reserved, maxLen, {
    allowCallsignSuffixDowngrade: false,
  });
  const exported = sanitiseAsciiWireString(finalized);
  if (collided) {
    pushWireNameCollisionWarning(warnings, {
      entityKind: 'Talk group',
      candidate: stem,
      disambiguated: exported,
    });
  }
  pushWireNameLengthWarning(warnings, {
    entityKind: 'Talk group',
    original,
    exported,
    maxLen,
    profileId: profileId ?? options?.profileId,
    shortenEnabled: true,
  });
  return exported;
}

/** Build stable talk-group id → export wire name map for one export pass. */
export function buildTalkGroupWireNameMap(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
  warnings?: ExportWarning[],
): Map<string, string> {
  const profileId = options?.profileId ?? assembled.profileId;
  const sink = warnings ?? [];
  const reserved = new Set<string>();
  const map = new Map<string, string>();

  for (const row of assembled.talkGroups) {
    const isOverride = Boolean(row.wireNameOverride?.trim());
    map.set(
      row.entity.id,
      applyTalkGroupWireNameLimits(
        row.wireName,
        row.entity,
        reserved,
        options,
        profileId,
        sink,
        undefined,
        isOverride,
      ),
    );
  }

  return map;
}

/** Shallow copy of assembled build with talk-group wire names shortened for export. */
export function withTalkGroupWireNameLimits(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
  warnings?: ExportWarning[],
): AssembledBuild {
  const map = buildTalkGroupWireNameMap(assembled, options, warnings);
  if (assembled.talkGroups.every((row) => map.get(row.entity.id) === row.wireName)) {
    return assembled;
  }
  return {
    ...assembled,
    talkGroups: assembled.talkGroups.map((row) => ({
      ...row,
      wireName: map.get(row.entity.id) ?? row.wireName,
    })),
  };
}
