import type { AssembledBuild, AssembledChannel } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { CHIRP_HEADERS } from './columns.ts';
import { formatCsv } from './csvWrite.ts';
import {
  blankChirpMemoryRow,
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

  const byId = channelById(assembled);
  const memorySlots = assembled.channelMemorySlots;
  const analogueRows: { slot: number; row: AssembledChannel }[] = [];
  const skippedDigital: string[] = [];

  if (memorySlots && memorySlots.length > 0) {
    for (const slot of memorySlots) {
      if (!slot.channelId) continue;
      const row = byId.get(slot.channelId);
      if (!row) continue;
      if (!isChirpAnalogueExportable(row.entity)) {
        skippedDigital.push(row.wireName || row.entity.name);
        continue;
      }
      analogueRows.push({ slot: slot.slot, row });
    }
  } else {
    for (const row of assembled.channels) {
      if (!isChirpAnalogueExportable(row.entity)) {
        skippedDigital.push(row.wireName || row.entity.name);
        continue;
      }
      analogueRows.push({ slot: analogueRows.length + 1, row });
    }
  }

  if (skippedDigital.length > 0) {
    warnings.push(
      `Skipped ${skippedDigital.length} non-analogue channel(s): ${skippedDigital.join(', ')}`,
    );
  }

  const maxSlot =
    memorySlots && memorySlots.length > 0
      ? memorySlots[memorySlots.length - 1]!.slot
      : analogueRows.length;
  const rowsBySlot = new Map(analogueRows.map((entry) => [entry.slot, entry.row]));
  const blankSlots = new Set(
    (memorySlots ?? []).filter((slot) => slot.channelId == null).map((slot) => slot.slot),
  );

  let exportCount = rowsBySlot.size;
  if (exportCount > profile.maxMemorySlots) {
    const excess = exportCount - profile.maxMemorySlots;
    warnings.push(
      `Truncated ${excess} channel(s) to fit ${profile.maxMemorySlots} memory slots for ${profile.label}.`,
    );
    exportCount = profile.maxMemorySlots;
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
  const rows: string[][] = [];
  let emittedChannels = 0;
  for (let slot = 1; slot <= maxSlot; slot++) {
    const row = rowsBySlot.get(slot);
    if (row) {
      if (emittedChannels >= exportCount) continue;
      rows.push(channelToChirpRow(row, slot, profileId, wireOpts, scanContext, options));
      emittedChannels++;
      continue;
    }
    if (blankSlots.has(slot)) {
      rows.push(blankChirpMemoryRow(slot));
    }
  }

  return {
    csv: formatCsv([...CHIRP_HEADERS], rows),
    warnings,
  };
}
