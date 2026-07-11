import type { TalkGroup } from '@core/models/library.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { finalizeWireName, uniqueWireName } from './shortenName.ts';
import { sanitiseAsciiWireString } from '../sanitiseAsciiWireString.ts';
import { resolveMaxNameLength } from './exportWireNames.ts';
import { pushWireNameLengthWarning } from './wireNameWarning.ts';

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
  warnings: string[],
): string {
  const maxLen = resolveMaxNameLength(profileId ?? options?.profileId, options);
  const shorten = options?.shortenNames !== false;
  const original = baseWireName.trim();
  let base = original;

  if (!shorten || maxLen == null) {
    const name = sanitiseAsciiWireString(uniqueWireName(base, reserved));
    reserved.add(name);
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

  const exported = sanitiseAsciiWireString(
    finalizeWireName(base, reserved, maxLen, { allowCallsignSuffixDowngrade: false }),
  );
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
  warnings?: string[],
): Map<string, string> {
  const profileId = options?.profileId ?? assembled.profileId;
  const sink = warnings ?? [];
  const reserved = new Set<string>();
  const map = new Map<string, string>();

  for (const row of assembled.talkGroups) {
    map.set(
      row.entity.id,
      applyTalkGroupWireNameLimits(row.wireName, row.entity, reserved, options, profileId, sink),
    );
  }

  return map;
}

/** Shallow copy of assembled build with talk-group wire names shortened for export. */
export function withTalkGroupWireNameLimits(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
  warnings?: string[],
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
