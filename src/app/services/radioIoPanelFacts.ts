/**
 * What the Export panel says about the build before a Write (#1393): counts for the header line and
 * the channels the radio cannot receive. Pure; the panel loads the library slice.
 */

import { isEntityExcluded } from '@core/domain/formatBuildOverrides.ts';
import { listIneligibleChannels } from '@core/domain/channelEligibility.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { assemble, type LibrarySlice } from '@core/services/assemble.ts';

export interface RadioIoPanelFacts {
  channelCount: number;
  zoneCount: number;
  /** Names of channels outside the radio's receive bands; the Write skips them. */
  outOfRangeChannelNames: string[];
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
  };
}
