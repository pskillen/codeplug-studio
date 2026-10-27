/**
 * What the Export panel says about the build before a Write (#1393): counts for the header line and
 * the channels the radio cannot receive. Pure; the panel loads the library slice.
 */

import { isEntityExcluded } from '@core/domain/formatBuildOverrides.ts';
import { listIneligibleChannels } from '@core/domain/channelEligibility.ts';
import { defaultOwnDigitalId } from '@core/domain/ownDigitalIds.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { assemble, type LibrarySlice } from '@core/services/assemble.ts';

export interface RadioIoPanelFacts {
  channelCount: number;
  zoneCount: number;
  /** Names of channels outside the radio's receive bands; the Write skips them. */
  outOfRangeChannelNames: string[];
  /** The library has a default DMR Digital ID (the AT-D890 writes radio IDs only then). */
  hasDefaultDmrId: boolean;
  /** The library has a default NXDN Digital ID (the AT-D890 MM9PDY writes the radio's NXDN ID only then). */
  hasDefaultNxdnId: boolean;
}

export function radioIoPanelFacts(
  build: RadioBuild,
  egress: EgressPath,
  library: LibrarySlice,
): RadioIoPanelFacts {
  const assembled = assemble(build, library, {
    formatId: egress.formatId,
    profileId: egress.profileId,
  });
  const candidates = library.channels.filter(
    (channel) => !isEntityExcluded(build.channelOverrides, channel.id),
  );
  const outOfRangeChannelNames = listIneligibleChannels(build, candidates)
    .filter((row) => row.reason === 'out-of-range')
    .map((row) => row.channel.name);
  return {
    channelCount: assembled.channels.length,
    zoneCount: assembled.zones.length,
    outOfRangeChannelNames,
    hasDefaultDmrId: defaultOwnDigitalId(library.ownDigitalIds ?? [], 'dmr') !== null,
    hasDefaultNxdnId: defaultOwnDigitalId(library.ownDigitalIds ?? [], 'nxdn') !== null,
  };
}

/** "412 channels · 18 zones · 3 radio-setting changes" (settings part only when `settingChanges` is given). */
export function buildSummaryLine(input: {
  channels: number;
  zones: number;
  settingChanges?: number;
}): string {
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const parts = [
    plural(input.channels, 'channel', 'channels'),
    plural(input.zones, 'zone', 'zones'),
  ];
  if (input.settingChanges !== undefined) {
    parts.push(plural(input.settingChanges, 'radio-setting change', 'radio-setting changes'));
  }
  return parts.join(' · ');
}
