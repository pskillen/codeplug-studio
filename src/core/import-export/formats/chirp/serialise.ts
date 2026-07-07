import type { AssembledBuild, AssembledChannel } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { CHIRP_HEADERS } from './columns.ts';
import { formatCsv } from './csvWrite.ts';
import {
  buildChirpScanContext,
  channelToChirpRow,
  effectiveMaxNameLength,
  type ChirpChannelWireOptions,
} from './exportChannelWire.ts';
import { getChirpProfile } from './profiles.ts';
import { isChirpAnalogueExportable } from './channelWire.ts';

export interface ChirpSerialiseResult {
  csv: string;
  warnings: string[];
}

function channelById(assembled: AssembledBuild): Map<string, AssembledChannel> {
  return new Map(assembled.channels.map((row) => [row.entity.id, row]));
}

export function serialiseChirpCsv(
  assembled: AssembledBuild,
  options?: CpsExportOptions,
): ChirpSerialiseResult {
  const profileId = options?.profileId ?? assembled.profileId;
  const profile = getChirpProfile(profileId);
  const warnings: string[] = [];

  const orderedIds =
    assembled.flatMemory?.channelIds ?? assembled.channels.map((row) => row.entity.id);

  const byId = channelById(assembled);
  const analogueRows: AssembledChannel[] = [];
  const skippedDigital: string[] = [];

  for (const id of orderedIds) {
    const row = byId.get(id);
    if (!row) continue;
    if (!isChirpAnalogueExportable(row.entity)) {
      skippedDigital.push(row.wireName || row.entity.name);
      continue;
    }
    analogueRows.push(row);
  }

  if (skippedDigital.length > 0) {
    warnings.push(
      `Skipped ${skippedDigital.length} non-analogue channel(s): ${skippedDigital.join(', ')}`,
    );
  }

  let exportRows = analogueRows;
  if (exportRows.length > profile.maxMemorySlots) {
    const excess = exportRows.length - profile.maxMemorySlots;
    warnings.push(
      `Truncated ${excess} channel(s) to fit ${profile.maxMemorySlots} memory slots for ${profile.label}.`,
    );
    exportRows = exportRows.slice(0, profile.maxMemorySlots);
  }

  const reserved = new Set<string>();
  const wireOpts: ChirpChannelWireOptions = {
    reserved,
    maxNameLength: effectiveMaxNameLength(options, profileId),
    shortenNames: options?.shortenNames ?? true,
    nameModeOverride: options?.nameModeOverride as ChirpChannelWireOptions['nameModeOverride'],
    useChannelAbbreviation: options?.useChannelAbbreviation,
    warnings,
  };

  const scanContext = buildChirpScanContext(options);
  const rows = exportRows.map((row, index) =>
    channelToChirpRow(row, index + 1, profileId, wireOpts, scanContext, options),
  );

  return {
    csv: formatCsv([...CHIRP_HEADERS], rows),
    warnings,
  };
}
