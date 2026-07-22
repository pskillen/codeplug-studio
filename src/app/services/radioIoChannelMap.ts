/**
 * Map assemble() projection channels → radio-boundary DTOs for Web Serial encode.
 * No framing — integrations radio modules consume RadioChannelDto only.
 */

import type { AssembledChannel } from '@core/services/assemble.ts';
import type { ChannelTone } from '@core/models/library.ts';
import type { RadioChannelDto, RadioTone } from '@integrations/radio-io/radioChannelDto.ts';

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

/**
 * Convert assembled channels to RadioChannelDto list.
 * Slot: `orderOrSlot` when set, else stable 1-based index in assemble order.
 * Empty / missing RX frequency → skipped (not written as empty slots).
 */
export function assembledChannelsToRadioDtos(
  channels: readonly AssembledChannel[],
): RadioChannelDto[] {
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
      wireName: row.wireName,
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
