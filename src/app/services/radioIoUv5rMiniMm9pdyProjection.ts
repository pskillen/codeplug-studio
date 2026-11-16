/**
 * UV-5R Mini MM9PDY write projection helpers: text at the radio boundary, zone finishing and the
 * warnings the operator needs. Pure; the caller supplies the zone DTOs from the shared zone builder.
 * Channel numbering follows zones exactly as for the RT95 MM9PDY, so the zone-ordered assembly is
 * shared (see {@link uv5rMiniMm9pdyZoneOrderedAssembled}).
 */

import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import { pushGeneralInfoWarning, pushGeneralWarning } from '@core/import-export/exportWarning.ts';
import { toRt95Ascii } from '@core/import-export/formatProfiles.ts';
import { UV5R_MINI_LIMITS } from '@core/radios/baofeng/uv-5r-mini/limits.ts';
import { checkZoneScanSets } from '@core/import-export/zoneScanSets/index.ts';
import {
  fillMiniScanSets,
  MMZS_MEMBER_CAPACITY_BITS,
} from '@integrations/radio-io/radios/uv5r-mini/modData/scanSets.ts';
import type { RadioZoneDto } from '@integrations/radio-io/radioWriteProjection.ts';
import { rt95Mm9pdyZoneOrderedAssembled, scanSetWithin } from './radioIoRt95Mm9pdyProjection.ts';

/** Same rule as the RT95: zones in build order, members in zone order, first appearance wins. */
export const uv5rMiniMm9pdyZoneOrderedAssembled = rt95Mm9pdyZoneOrderedAssembled;

export interface Uv5rMiniMm9pdyProjectionInput {
  /** Zones from the shared zone builder, uncapped, wire names already resolved. */
  zones: readonly RadioZoneDto[];
  warnings: ExportWarning[];
}

export function projectUv5rMiniMm9pdy(input: Uv5rMiniMm9pdyProjectionInput): {
  zones: RadioZoneDto[];
} {
  const { warnings } = input;
  const { ZONE_MAX, ZONE_NAME_LENGTH, ZONE_SLOTS } = UV5R_MINI_LIMITS;

  const zones: RadioZoneDto[] = [];
  for (const zone of input.zones) {
    const folded = toRt95Ascii(zone.wireName, { forbidUnderscore: false });
    let name = folded.text.slice(0, ZONE_NAME_LENGTH).trim();
    if (name === '') name = `Zone ${zones.length + 1}`;
    if (folded.replaced) {
      pushGeneralWarning(
        warnings,
        `Zone "${name}": characters the radio cannot show were replaced with "-".`,
      );
    }
    if (folded.text.length > ZONE_NAME_LENGTH) {
      pushGeneralWarning(
        warnings,
        `Zone "${folded.text}" was shortened to "${name}" to fit the radio's ${ZONE_NAME_LENGTH}-character zone names.`,
      );
    }

    const wanted = [...new Set(zone.channelNumbers)];
    const members = wanted.filter((n) => n >= 1 && n <= ZONE_SLOTS);
    if (members.length < wanted.length) {
      pushGeneralWarning(
        warnings,
        `Zone "${name}": channels beyond ${ZONE_SLOTS} are not on the radio and were left out of the zone.`,
      );
    }
    if (members.length === 0) {
      pushGeneralWarning(
        warnings,
        `Zone "${name}" has no channels on the radio, so empty zones are skipped and it was not written.`,
      );
      continue;
    }
    const ascending = [...members].sort((a, b) => a - b);
    const inOrder =
      ascending.length === zone.channelNumbers.length &&
      ascending.every((n, i) => n === zone.channelNumbers[i]);
    if (!inOrder) {
      pushGeneralInfoWarning(
        warnings,
        `Zone "${name}": the radio steps through its channels in channel-number order.`,
      );
    }
    zones.push({ wireName: name, channelNumbers: ascending, ...scanSetWithin(zone, ascending) });
  }

  if (zones.length > ZONE_MAX) {
    const dropped = zones.length - ZONE_MAX;
    pushGeneralWarning(
      warnings,
      `${dropped} zones were not written: the UV-5R Mini MM9PDY firmware holds ${ZONE_MAX}.`,
    );
    zones.length = ZONE_MAX;
  }

  const sets = zones.map((zone) => ({
    zoneName: zone.wireName,
    scanChannelNumbers: zone.scanChannelNumbers ?? zone.channelNumbers,
  }));
  const encoded = fillMiniScanSets(
    zones.map((zone) => {
      const included = new Set(zone.scanChannelNumbers ?? zone.channelNumbers);
      return zone.channelNumbers.map((n) => included.has(n));
    }),
  );
  checkZoneScanSets(
    sets.map((set, i) =>
      encoded.fallback.includes(i) ? { ...set, scanChannelNumbers: zones[i]!.channelNumbers } : set,
    ),
    {
      roomExceeded: () =>
        encoded.fallback.length
          ? {
              limit: MMZS_MEMBER_CAPACITY_BITS,
              needed: encoded.needed,
              unit: 'member bits',
              consequence: `These zones scan every member: ${encoded.fallback.map((i) => `"${zones[i]!.wireName}"`).join(', ')}.`,
            }
          : undefined,
    },
    warnings,
  );

  if (encoded.kinds.includes(1)) {
    pushGeneralInfoWarning(
      warnings,
      "Some zones scan only part of their channels. Firmware older than 1.1.0 uses each channel's Scan in All channels setting instead, or scans all channels if none are included.",
    );
  }

  return { zones };
}
