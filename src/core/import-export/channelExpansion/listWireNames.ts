import type { CpsExportOptions } from '@core/import-export/types.ts';
import { resolveMaxNameLength } from './exportWireNames.ts';
import { finalizeWireName, hardTruncateUniqueWireName, uniqueWireName } from './shortenName.ts';
import { sanitiseAsciiWireString } from '../sanitiseAsciiWireString.ts';
import {
  pushWireNameCollisionWarning,
  pushWireNameLengthWarning,
  type WireNameEntityKind,
} from './wireNameWarning.ts';

/** Shorten zone / scan list / RX group list / contact wire names at CPS export. */
export function applyListWireNameLimits(
  baseWireName: string,
  reserved: Set<string>,
  options: CpsExportOptions | undefined,
  profileId: string | undefined,
  warnings: string[],
  entityKind: WireNameEntityKind = 'Wire name',
  /** Override profile `nameLimit` (e.g. DM32 Scan Name ≤10). */
  maxLenOverride?: number,
  isOverride = false,
): string {
  const maxLen = maxLenOverride ?? resolveMaxNameLength(profileId ?? options?.profileId, options);
  const shorten = options?.shortenNames !== false;
  const original = baseWireName.trim();
  const base = original;

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
          entityKind,
          candidate: stem,
          disambiguated: name,
        });
      }
      pushWireNameLengthWarning(warnings, {
        entityKind,
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
      entityKind,
      candidate: base,
      disambiguated: name,
    });
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
      entityKind,
      candidate: stem,
      disambiguated: exported,
    });
  }
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
  entries: ReadonlyArray<{
    id: string;
    wireName: string;
    entityKind?: WireNameEntityKind;
    isOverride?: boolean;
  }>,
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
        undefined,
        entry.isOverride === true,
      ),
    );
  }
  return map;
}
