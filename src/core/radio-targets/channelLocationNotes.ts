/**
 * MM9PDY channel location table — which targets write it, and the write-time notes
 * (#1383; spec `firmware-mods/features/channel-distance.md`, "Warnings in Studio").
 *
 * Notes, not blocking confirmations: nothing the operator cares about is destroyed,
 * and the radio hides any position that no longer matches its channel.
 */

import type { Channel } from '@core/models/library.ts';
import { channelHasUsableLocation } from '@core/domain/channelLocation.ts';
import { pushGeneralInfoWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';

/** Stock radio target → its MM9PDY modded-firmware sibling (the only targets with a table). */
const MM9PDY_SIBLING_BY_STOCK_TARGET: Readonly<Record<string, string>> = {
  'anytone-at-d890uv': 'anytone-at-d890uv-mm9pdy',
  'baofeng-dm32uv': 'baofeng-dm32uv-mm9pdy',
};

const MM9PDY_CHANNEL_LOCATION_TARGETS = new Set(Object.values(MM9PDY_SIBLING_BY_STOCK_TARGET));

/** True for the MM9PDY targets that write the channel location table. */
export function isMm9pdyChannelLocationTarget(radioTargetId: string | undefined): boolean {
  return radioTargetId != null && MM9PDY_CHANNEL_LOCATION_TARGETS.has(radioTargetId);
}

/** True for a stock target that has an MM9PDY sibling (and so gets the "use MM9PDY" note). */
export function hasMm9pdyChannelLocationSibling(radioTargetId: string | undefined): boolean {
  return radioTargetId != null && radioTargetId in MM9PDY_SIBLING_BY_STOCK_TARGET;
}

/** Per-slot outcome counts for one MM9PDY Write. */
export interface ChannelLocationWriteCounts {
  /** Slots whose position is written. */
  written: number;
  /** Slots whose channel has no usable position. */
  noPosition: number;
  /** Slots whose channel has a position but *Use location* off. */
  useLocationOff: number;
  /** Slots with a position beyond the radio's table capacity. */
  overCapacity: number;
}

export function emptyChannelLocationWriteCounts(): ChannelLocationWriteCounts {
  return { written: 0, noPosition: 0, useLocationOff: 0, overCapacity: 0 };
}

/** Count the channels a stock target would leave without a position (Use location on). */
export function countChannelsWithUsableLocation(
  channels: readonly Pick<Channel, 'location' | 'useLocation'>[],
): number {
  return channels.filter(channelHasUsableLocation).length;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Write radio popup note on an MM9PDY target with located channels. */
export function mm9pdyChannelLocationWriteNote(written: number): string {
  return `${plural(written, 'channel position is', 'channel positions are')} written. A later write from the official CPS or a stock target may leave them out of date: write from this target again afterwards.`;
}

/** Note on a stock D890 / DM32 target (Web Serial or file) with located channels. */
export function stockChannelLocationNote(locatedChannels: number): string {
  return `${plural(locatedChannels, 'channel in this build has', 'channels in this build have')} a position. Positions are not written by this target: the MM9PDY modded firmware target writes them.`;
}

/** Summary sentence for the post-write info warning; `null` when nothing is located. */
export function channelLocationWriteSummary(counts: ChannelLocationWriteCounts): string | null {
  const skipped: string[] = [];
  if (counts.useLocationOff > 0) {
    skipped.push(`${counts.useLocationOff} with Use location off`);
  }
  if (counts.overCapacity > 0) {
    skipped.push(`${counts.overCapacity} over the radio's table capacity`);
  }
  if (counts.written === 0 && skipped.length === 0) return null;
  const head = `Channel positions: ${counts.written} written`;
  const noPosition =
    counts.noPosition > 0
      ? ` ${plural(counts.noPosition, 'channel has', 'channels have')} no position.`
      : '';
  return skipped.length > 0
    ? `${head}; ${skipped.join(', ')} not written.${noPosition}`
    : `${head}.${noPosition}`;
}

/** Push the MM9PDY Write summary as an `info` warning (no-op when nothing is located). */
export function pushChannelLocationWriteSummary(
  warnings: ExportWarning[],
  counts: ChannelLocationWriteCounts,
): void {
  const message = channelLocationWriteSummary(counts);
  if (message) pushGeneralInfoWarning(warnings, message);
}

/**
 * Stock D890 / DM32 export or Write: push an `info` note when the build has located
 * channels. Other targets (no MM9PDY sibling) and MM9PDY targets push nothing.
 */
export function pushStockChannelLocationNote(
  warnings: ExportWarning[],
  radioTargetId: string | undefined,
  channels: readonly Pick<Channel, 'location' | 'useLocation'>[],
): void {
  if (!hasMm9pdyChannelLocationSibling(radioTargetId)) return;
  const located = countChannelsWithUsableLocation(channels);
  if (located > 0) pushGeneralInfoWarning(warnings, stockChannelLocationNote(located));
}

/**
 * Write radio popup note for a build, or `null`. MM9PDY targets: the count of positions
 * that will be written. Stock D890 / DM32 targets: that positions need the MM9PDY target.
 * Every other target: nothing.
 */
export function channelLocationWriteRadioNote(
  radioTargetId: string | undefined,
  summary: { counts?: ChannelLocationWriteCounts; locatedChannels: number } | undefined,
): string | null {
  if (!summary) return null;
  if (isMm9pdyChannelLocationTarget(radioTargetId)) {
    const written = summary.counts?.written ?? 0;
    return written > 0 ? mm9pdyChannelLocationWriteNote(written) : null;
  }
  if (hasMm9pdyChannelLocationSibling(radioTargetId) && summary.locatedChannels > 0) {
    return stockChannelLocationNote(summary.locatedChannels);
  }
  return null;
}
