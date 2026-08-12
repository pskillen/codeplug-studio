import type { Channel } from '@core/models/library.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { getDm32Profile } from '@core/import-export/formats/dm32/profiles.ts';
import { getOpenGd77Profile } from '@core/import-export/formats/opengd77/profiles.ts';
import { getChirpProfile } from '@core/import-export/formats/chirp/profiles.ts';
import { getAnytoneProfile } from '@core/import-export/formats/anytone/profiles.ts';
import { neonplugNameLimit } from '@core/import-export/formats/neonplug/profiles.ts';
import { radioIoNameLimit } from '@core/import-export/formats/radio-io/profiles.ts';
import {
  channelPickForWireExport,
  composeChannelWireName,
  type ChannelExportNameMode,
} from '@core/domain/channelNaming.ts';
import {
  finalizeWireName,
  hardTruncateUniqueWireName,
  shortenWireName,
  uniqueWireName,
} from './shortenName.ts';
import { sanitiseAsciiWireString } from '../sanitiseAsciiWireString.ts';
import { pushWireNameCollisionWarning, pushWireNameLengthWarning } from './wireNameWarning.ts';

export function resolveMaxNameLength(
  profileId: string | undefined,
  options?: CpsExportOptions,
): number | undefined {
  if (options?.maxNameLength != null) return options.maxNameLength;
  if (!profileId) return undefined;
  if (profileId.startsWith('chirp-')) return getChirpProfile(profileId).nameLimit;
  if (profileId.startsWith('dm32-')) return getDm32Profile(profileId).nameLimit;
  if (profileId.startsWith('opengd77-')) return getOpenGd77Profile(profileId).nameLimit;
  if (profileId.startsWith('anytone-')) return getAnytoneProfile(profileId).nameLimit;
  if (profileId.startsWith('neonplug-')) return neonplugNameLimit(profileId);
  if (profileId.startsWith('radio-io-')) return radioIoNameLimit(profileId);
  return undefined;
}

export function composeExportWireName(channel: Channel, options?: CpsExportOptions): string {
  const pick = channelPickForWireExport(channel, {
    nameModeOverride: options?.nameModeOverride as ChannelExportNameMode | undefined,
  });
  return composeChannelWireName(pick);
}

/** Assembled channel → final CPS wire name (override, compose, shorten; abbrev only when over limit). */
export function assembledChannelExportWireName(
  row: { entity: Channel; wireName: string; wireNameOverride?: string },
  reserved: Set<string>,
  options: CpsExportOptions | undefined,
  profileId: string | undefined,
  warnings: string[],
): string {
  const isOverride = Boolean(row.wireNameOverride?.trim());
  const base = isOverride ? row.wireName : composeExportWireName(row.entity, options);
  return applyWireNameLimits(
    base,
    row.entity,
    reserved,
    options,
    profileId,
    warnings,
    true,
    isOverride,
  );
}

export function applyWireNameLimits(
  baseWireName: string,
  channel: Channel,
  reserved: Set<string>,
  options: CpsExportOptions | undefined,
  profileId: string | undefined,
  warnings: string[],
  reserve = true,
  isOverride = false,
): string {
  const maxLen = resolveMaxNameLength(profileId ?? options?.profileId, options);
  const shorten = options?.shortenNames !== false;
  const original = baseWireName.trim();

  if (isOverride || !shorten || maxLen == null) {
    if (isOverride && maxLen != null) {
      const {
        name: truncated,
        collided,
        stem,
      } = hardTruncateUniqueWireName(original, reserved, maxLen, reserve);
      const name = sanitiseAsciiWireString(truncated);
      if (collided) {
        pushWireNameCollisionWarning(warnings, {
          entityKind: 'Channel',
          candidate: stem,
          disambiguated: name,
        });
      }
      pushWireNameLengthWarning(warnings, {
        entityKind: 'Channel',
        original,
        exported: name,
        maxLen,
        profileId: profileId ?? options?.profileId,
        shortenEnabled: false,
      });
      return name;
    }

    const uniquified = reserve ? uniqueWireName(original, reserved) : original;
    const name = sanitiseAsciiWireString(uniquified);
    if (reserve) {
      reserved.add(name);
      pushWireNameCollisionWarning(warnings, {
        entityKind: 'Channel',
        candidate: original,
        disambiguated: name,
      });
    }
    if (maxLen != null) {
      pushWireNameLengthWarning(warnings, {
        entityKind: 'Channel',
        original,
        exported: name,
        maxLen,
        profileId: profileId ?? options?.profileId,
        shortenEnabled: false,
      });
    }
    return name;
  }

  const pick = channelPickForWireExport(channel, {
    nameModeOverride: options?.nameModeOverride as ChannelExportNameMode | undefined,
  });
  const abbrev = channel.abbreviation?.trim();
  const recomposeWithChannelAbbreviation =
    abbrev && options?.useChannelAbbreviation !== false
      ? () => composeChannelWireName({ ...pick, name: abbrev })
      : undefined;

  const shortenOpts = {
    exportNameMode: pick.exportNameMode,
    recomposeWithMode: (mode: ChannelExportNameMode) =>
      composeChannelWireName({ ...pick, exportNameMode: mode }),
    recomposeWithChannelAbbreviation,
  };

  if (!reserve) {
    const exported = sanitiseAsciiWireString(shortenWireName(original, maxLen, shortenOpts));
    pushWireNameLengthWarning(warnings, {
      entityKind: 'Channel',
      original,
      exported,
      maxLen,
      profileId: profileId ?? options?.profileId,
      shortenEnabled: true,
    });
    return exported;
  }

  const {
    name: finalized,
    collided,
    stem,
  } = finalizeWireName(original, reserved, maxLen, shortenOpts);
  const exported = sanitiseAsciiWireString(finalized);
  if (collided) {
    pushWireNameCollisionWarning(warnings, {
      entityKind: 'Channel',
      candidate: stem,
      disambiguated: exported,
    });
  }
  pushWireNameLengthWarning(warnings, {
    entityKind: 'Channel',
    original,
    exported,
    maxLen,
    profileId: profileId ?? options?.profileId,
    shortenEnabled: true,
  });
  return exported;
}
