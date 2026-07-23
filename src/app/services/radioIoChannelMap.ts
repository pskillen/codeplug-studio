/**
 * Map assemble() projection channels → radio-boundary DTOs for Web Serial encode.
 * Applies RadioBuild export name settings (profile nameLimit, shortenNames, …).
 * No framing — integrations radio modules consume RadioChannelDto only.
 */

import type { AssembledChannel } from '@core/services/assemble.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import type { ChannelTone } from '@core/models/library.ts';
import { channelPickForWireExport, composeChannelWireName } from '@core/domain/channelNaming.ts';
import type { ChannelExportNameMode } from '@core/domain/channelNaming.ts';
import { applyWireNameLimits } from '@core/import-export/channelExpansion/exportWireNames.ts';
import { mergeExportOptions } from '@core/import-export/exportSettingsMerge.ts';
import type { RadioChannelDto, RadioTone } from '@integrations/radio-io/radioChannelDto.ts';

export interface RadioWireEgressIds {
  formatId: string;
  profileId: string;
}

function parseChannelTone(tone: ChannelTone | undefined): RadioTone {
  if (!tone || tone === 'none') return { kind: 'none' };
  const s = tone.trim();
  if (!s || s === '—' || s.toLowerCase() === 'none') return { kind: 'none' };
  if (s.includes('.')) {
    const hz = parseFloat(s);
    if (!Number.isNaN(hz)) return { kind: 'ctcss', hz };
  }
  const code = parseInt(s, 10);
  if (!Number.isNaN(code) && Number.isInteger(code)) return { kind: 'dcs', code };
  return { kind: 'none' };
}

function bandwidthFromKHz(bandwidthKHz: number | null | undefined): 'FM' | 'NFM' {
  if (bandwidthKHz == null) return 'FM';
  return bandwidthKHz <= 15 ? 'NFM' : 'FM';
}

function radioWireName(
  row: AssembledChannel,
  build: RadioBuild,
  egress: RadioWireEgressIds,
  reserved: Set<string>,
  warnings: string[],
): string {
  const merged = mergeExportOptions(build, egress.formatId);
  const pick = channelPickForWireExport(row.entity, {
    nameModeOverride: merged.nameModeOverride as ChannelExportNameMode | undefined,
  });
  let base = row.wireNameOverride?.trim() ? row.wireName : composeChannelWireName(pick);
  const abbrev = row.entity.abbreviation?.trim();
  if (abbrev && merged.useChannelAbbreviation !== false) {
    base = composeChannelWireName({ ...pick, name: abbrev });
  }
  return applyWireNameLimits(
    base,
    row.entity,
    reserved,
    merged,
    merged.profileId ?? egress.profileId,
    warnings,
  );
}

/**
 * Convert assembled channels to RadioChannelDto list.
 * Slot: `orderOrSlot` when set, else stable 1-based index in assemble order.
 * Empty / missing RX frequency → skipped (not written as empty slots).
 */
export function assembledChannelsToRadioDtos(
  channels: readonly AssembledChannel[],
  build: RadioBuild,
  egress: RadioWireEgressIds,
): RadioChannelDto[] {
  const reserved = new Set<string>();
  const warnings: string[] = [];
  const dtos: RadioChannelDto[] = [];
  channels.forEach((row, index) => {
    const rxHz = row.entity.rxFrequency;
    if (rxHz == null || rxHz <= 0) return;
    const analog = row.entity.modeProfiles.find((p) => p.mode === 'fm' || p.mode === 'am');
    const txHz = row.entity.txFrequency ?? rxHz;
    const slotIndex = row.orderOrSlot != null && row.orderOrSlot > 0 ? row.orderOrSlot : index + 1;
    dtos.push({
      slotIndex,
      empty: false,
      wireName: radioWireName(row, build, egress, reserved, warnings),
      rxHz,
      txHz,
      rxTone: parseChannelTone(analog && 'rxTone' in analog ? analog.rxTone : 'none'),
      txTone: parseChannelTone(analog && 'txTone' in analog ? analog.txTone : 'none'),
      powerPercent: row.entity.power,
      bandwidth: bandwidthFromKHz(analog && 'bandwidthKHz' in analog ? analog.bandwidthKHz : null),
    });
  });
  return dtos;
}
