import type { CpsExportOptions } from '@core/import-export/types.ts';
import { resolveMaxNameLength } from './exportWireNames.ts';
import { finalizeWireName, uniqueWireName } from './shortenName.ts';
import { sanitiseAsciiWireString } from '../sanitiseAsciiWireString.ts';
import { pushWireNameLengthWarning, type WireNameEntityKind } from './wireNameWarning.ts';

/** Shorten zone / scan list / RX group list / contact wire names at CPS export. */
export function applyListWireNameLimits(
  baseWireName: string,
  reserved: Set<string>,
  options: CpsExportOptions | undefined,
  profileId: string | undefined,
  warnings: string[],
  entityKind: WireNameEntityKind = 'Wire name',
): string {
  const maxLen = resolveMaxNameLength(profileId ?? options?.profileId, options);
  const shorten = options?.shortenNames !== false;
  const original = baseWireName.trim();
  const base = original;

  if (!shorten || maxLen == null) {
    const name = sanitiseAsciiWireString(uniqueWireName(base, reserved));
    reserved.add(name);
    if (maxLen != null) {
      pushWireNameLengthWarning(warnings, {
        entityKind,
        original,
        exported: name,
        maxLen,
        profileId: profileId ?? options?.profileId,
        shortenEnabled: false,
      });
    }
    return name;
  }

  const exported = sanitiseAsciiWireString(
    finalizeWireName(base, reserved, maxLen, { allowCallsignSuffixDowngrade: false }),
  );
  pushWireNameLengthWarning(warnings, {
    entityKind,
    original,
    exported,
    maxLen,
    profileId: profileId ?? options?.profileId,
    shortenEnabled: true,
  });
  return exported;
}

export function buildListWireNameMap(
  entries: ReadonlyArray<{ id: string; wireName: string; entityKind?: WireNameEntityKind }>,
  reserved: Set<string>,
  options: CpsExportOptions | undefined,
  profileId: string | undefined,
  warnings: string[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    map.set(
      entry.id,
      applyListWireNameLimits(
        entry.wireName,
        reserved,
        options,
        profileId,
        warnings,
        entry.entityKind ?? 'Wire name',
      ),
    );
  }
  return map;
}

export const FORMATS_WITH_LIST_NAME_SHORTENING = new Set(['anytone', 'opengd77', 'dm32']);

export function formatUsesListNameShortening(formatId: string): boolean {
  return FORMATS_WITH_LIST_NAME_SHORTENING.has(formatId);
}
