/**
 * Build RadioWriteProjection from assemble + shared m×n expand for Web Serial Write.
 * Organisation rows (zones/scan/TG/…) are filled in later #667 slices; channels + slot map ship first.
 */

import type { AssembledBuild, LibrarySlice } from '@core/services/assemble.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import { expandAllMxNChannels } from '@core/import-export/channelExpansion/mxnExpandAll.ts';
import { filterExpandedRowsByOverrides } from '@core/domain/formatBuildOverrides.ts';
import { mergeExportOptions } from '@core/import-export/exportSettingsMerge.ts';
import { getProfileExportLimits } from '@core/import-export/profileExportLimits.ts';
import type { FormatId } from '@core/import-export/types.ts';
import { hasMxNChannelExpansion } from '@core/radio-targets/index.ts';
import type { RadioWriteProjection } from '@integrations/radio-io/radioWriteProjection.ts';
import {
  expandAssembledChannelsToRadioDtos,
  type RadioWireEgressIds,
} from './radioIoChannelMap.ts';

function buildNumbersBySourceChannelId(
  assembled: AssembledBuild,
  build: RadioBuild,
  library: Pick<LibrarySlice, 'talkGroups' | 'digitalContacts'>,
  egress: RadioWireEgressIds,
  warnings: string[],
  maxSlots: number | undefined,
): Map<string, number[]> {
  const map = new Map<string, number[]>();

  if (!hasMxNChannelExpansion(build.radioTargetId)) {
    let autoSlot = 1;
    for (const row of assembled.channels) {
      const rxHz = row.entity.rxFrequency;
      if (rxHz == null || rxHz <= 0) continue;
      const slot = row.orderOrSlot != null && row.orderOrSlot > 0 ? row.orderOrSlot : autoSlot;
      if (maxSlots != null && slot > maxSlots) continue;
      const list = map.get(row.entity.id) ?? [];
      list.push(slot);
      map.set(row.entity.id, list);
      if (row.orderOrSlot == null || row.orderOrSlot <= 0) autoSlot += 1;
    }
    return map;
  }

  const merged = mergeExportOptions(build, egress.formatId, { profileId: egress.profileId });
  const expanded = filterExpandedRowsByOverrides(
    expandAllMxNChannels({
      assembled,
      library,
      radioTargetId: build.radioTargetId,
      options: merged,
      warnings,
    }),
    build.channelOverrides,
  );

  const channelById = new Map(assembled.channels.map((row) => [row.entity.id, row.entity]));
  let slotIndex = 1;
  for (const projection of expanded) {
    const channel = channelById.get(projection.sourceChannelId);
    if (!channel) continue;
    const rxHz = channel.rxFrequency;
    if (rxHz == null || rxHz <= 0) continue;
    if (maxSlots != null && slotIndex > maxSlots) break;
    const list = map.get(projection.sourceChannelId) ?? [];
    list.push(slotIndex);
    map.set(projection.sourceChannelId, list);
    slotIndex += 1;
  }
  return map;
}

/**
 * Assemble → channel DTOs + source→number map + organisation shell.
 * Zone/scan/TG/RX/contact/APRS organisation is populated by later slices.
 */
export function buildRadioWriteProjection(
  assembled: AssembledBuild,
  build: RadioBuild,
  library: LibrarySlice,
  egress: RadioWireEgressIds,
): RadioWriteProjection {
  const { dtos, warnings } = expandAssembledChannelsToRadioDtos(
    assembled,
    build,
    library,
    egress,
  );
  const limits = getProfileExportLimits(egress.formatId as FormatId, egress.profileId);
  const numbersBySourceChannelId = buildNumbersBySourceChannelId(
    assembled,
    build,
    library,
    egress,
    warnings,
    limits?.maxChannels,
  );

  return {
    channels: dtos,
    organisation: {},
    numbersBySourceChannelId,
    warnings,
  };
}
