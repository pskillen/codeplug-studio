/**
 * RT95 MM9PDY write projection helpers: zone-ordered numbering, text at the radio boundary, zone
 * finishing and the warnings the operator needs. Pure; the caller (`buildRadioWriteProjection`)
 * supplies the zone DTOs from the shared zone builder.
 */

import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import { pushGeneralInfoWarning, pushGeneralWarning } from '@core/import-export/exportWarning.ts';
import {
  rt95Mm9pdyChannelDescription,
  toRt95Ascii,
} from '@core/import-export/formats/radio-io/rt95Mm9pdyText.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { AssembledBuild, LibrarySlice } from '@core/services/assemble.ts';
import type { RadioChannelDto } from '@integrations/radio-io/radioChannelDto.ts';
import type { RadioZoneDto } from '@integrations/radio-io/radioWriteProjection.ts';

/**
 * Channels reordered so the radio's channel-number order follows the zones: zones in build order,
 * members in zone order, first appearance wins; every remaining channel keeps its existing order.
 * Pinned `orderOrSlot` rows keep their pins (the numbering honours them).
 */
export function rt95Mm9pdyZoneOrderedAssembled(assembled: AssembledBuild): AssembledBuild {
  const byId = new Map(assembled.channels.map((row) => [row.entity.id, row]));
  const seen = new Set<string>();
  const ordered: AssembledBuild['channels'] = [];
  for (const zone of assembled.zones) {
    for (const channelId of zone.memberChannelIds) {
      const row = byId.get(channelId);
      if (!row || seen.has(channelId)) continue;
      seen.add(channelId);
      ordered.push(row);
    }
  }
  for (const row of assembled.channels) {
    if (!seen.has(row.entity.id)) ordered.push(row);
  }
  return { ...assembled, channels: ordered };
}

export interface Rt95Mm9pdyProjectionInput {
  channels: readonly RadioChannelDto[];
  /** Zones from the shared zone builder, uncapped, wire names already resolved. */
  zones: readonly RadioZoneDto[];
  assembled: AssembledBuild;
  build: RadioBuild;
  library: Pick<LibrarySlice, 'zones'>;
  numbersBySourceChannelId: ReadonlyMap<string, number[]>;
  maxZones: number;
  warnings: ExportWarning[];
}

export function projectRt95Mm9pdy(input: Rt95Mm9pdyProjectionInput): {
  channels: RadioChannelDto[];
  zones: RadioZoneDto[];
} {
  const { assembled, build, warnings } = input;

  // Channels: radio name text, description.
  const rowByNumber = new Map<number, (typeof assembled.channels)[number]>();
  for (const row of assembled.channels) {
    for (const n of input.numbersBySourceChannelId.get(row.entity.id) ?? []) {
      rowByNumber.set(n, row);
    }
  }
  const overrideByChannel = new Map(
    (build.channelOverrides ?? []).map((o) => [o.libraryEntityId, o] as const),
  );
  const spaced: string[] = [];
  const channels = input.channels.map((dto) => {
    if (dto.empty) return dto;
    const row = rowByNumber.get(dto.slotIndex);
    const name = toRt95Ascii(dto.wireName, { forbidUnderscore: false });
    if (name.replaced) {
      pushGeneralWarning(
        warnings,
        `Channel ${dto.slotIndex}: characters the RT95 cannot show were replaced with "-" in the radio name "${name.text}".`,
      );
    }
    if (name.text.trim().includes(' ')) spaced.push(name.text.trim());
    if (!row) return { ...dto, wireName: name.text };
    const description = rt95Mm9pdyChannelDescription(
      row.entity,
      name.text,
      overrideByChannel.get(row.entity.id)?.wireDescription,
    );
    if (description.replaced) {
      pushGeneralWarning(
        warnings,
        `Channel ${dto.slotIndex}: characters the RT95 cannot show were replaced with "-" in the description "${description.text}".`,
      );
    }
    if (description.shortened) {
      pushGeneralWarning(
        warnings,
        `Channel ${dto.slotIndex}: the description was shortened to "${description.text}" to fit the radio.`,
      );
    }
    return {
      ...dto,
      wireName: name.text,
      ...(description.text ? { description: description.text } : {}),
    };
  });
  if (spaced.length > 0) {
    const examples = spaced.slice(0, 3).join(', ');
    pushGeneralWarning(
      warnings,
      `The radio's large font draws spaces with zero width, so a name such as "${spaced[0]}" shows without its space (${examples}).`,
    );
  }

  // Zones: text, empties, cap, order.
  const zones: RadioZoneDto[] = [];
  for (const zone of input.zones) {
    const name = toRt95Ascii(zone.wireName, { forbidUnderscore: false });
    if (name.replaced) {
      pushGeneralWarning(
        warnings,
        `Zone "${name.text}": characters the RT95 cannot show were replaced with "-".`,
      );
    }
    if (zone.channelNumbers.length === 0) {
      pushGeneralWarning(
        warnings,
        `Zone "${name.text}" has no channels on the radio and was not written.`,
      );
      continue;
    }
    const ascending = [...new Set(zone.channelNumbers)].sort((a, b) => a - b);
    const inOrder =
      ascending.length === zone.channelNumbers.length &&
      ascending.every((n, i) => n === zone.channelNumbers[i]);
    if (!inOrder) {
      pushGeneralInfoWarning(
        warnings,
        `Zone "${name.text}": the radio steps through its channels in channel-number order.`,
      );
    }
    zones.push({ wireName: name.text, channelNumbers: ascending });
  }
  if (zones.length > input.maxZones) {
    const dropped = zones.length - input.maxZones;
    pushGeneralWarning(
      warnings,
      `${dropped} zones were not written: the RT95 MM9PDY firmware holds ${input.maxZones}.`,
    );
    zones.length = input.maxZones;
  }

  // Channels in no zone.
  const zoned = new Set<number>();
  for (const zone of zones) for (const n of zone.channelNumbers) zoned.add(n);
  const unzoned = channels.filter((c) => !c.empty && !zoned.has(c.slotIndex)).length;
  if (unzoned > 0) {
    pushGeneralInfoWarning(
      warnings,
      `${unzoned} channels are only in All channels (they are in no zone).`,
    );
  }

  // Per-zone scan choices.
  const exported = new Set(assembled.zones.map((z) => z.zoneId));
  const hasScanChoice = input.library.zones.some(
    (zone) =>
      exported.has(zone.id) &&
      zone.members.some(
        (m) =>
          m.kind === 'channel' &&
          m.includeInScanList !== undefined &&
          m.includeInScanList !== 'default',
      ),
  );
  if (hasScanChoice) {
    pushGeneralWarning(
      warnings,
      'The RT95 has one scan flag per channel; per-zone scan choices are ignored.',
    );
  }

  return { channels, zones };
}
