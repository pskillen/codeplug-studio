import type { Channel } from '@core/models/library.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { getDm32Profile } from '@core/import-export/formats/dm32/profiles.ts';
import { getOpenGd77Profile } from '@core/import-export/formats/opengd77/profiles.ts';
import { getChirpProfile } from '@core/import-export/formats/chirp/profiles.ts';
import { getAnytoneProfile } from '@core/import-export/formats/anytone/profiles.ts';
import { neonplugNameLimit } from '@core/import-export/formats/neonplug/profiles.ts';
import {
  channelPickForWireExport,
  composeChannelWireName,
  type ChannelExportNameMode,
} from '@core/domain/channelNaming.ts';
import { finalizeWireName, shortenWireName, uniqueWireName } from './shortenName.ts';
import { sanitiseAsciiWireString } from '../sanitiseAsciiWireString.ts';
import { pushWireNameLengthWarning } from './wireNameWarning.ts';

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
  return undefined;
}

export function composeExportWireName(channel: Channel, options?: CpsExportOptions): string {
  const pick = channelPickForWireExport(channel, {
    nameModeOverride: options?.nameModeOverride as ChannelExportNameMode | undefined,
  });
  return composeChannelWireName(pick);
}

export function applyWireNameLimits(
  baseWireName: string,
  channel: Channel,
  reserved: Set<string>,
  options: CpsExportOptions | undefined,
  profileId: string | undefined,
  warnings: string[],
  reserve = true,
): string {
  const maxLen = resolveMaxNameLength(profileId ?? options?.profileId, options);
  const shorten = options?.shortenNames !== false;
  const original = baseWireName.trim();

  if (!shorten || maxLen == null) {
    const name = sanitiseAsciiWireString(reserve ? uniqueWireName(original, reserved) : original);
    if (reserve) reserved.add(name);
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

  const exported = sanitiseAsciiWireString(
    finalizeWireName(original, reserved, maxLen, shortenOpts),
  );
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
