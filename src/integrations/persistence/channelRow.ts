import { normalizeChannel } from '@core/domain/normalizeChannel.ts';
import type { Channel } from '@core/models/library.ts';

type LegacyChannelRow = Channel & { scanSkip?: boolean };

/** Normalise legacy or partial channel rows read from storage. */
export function readChannelRow(row: LegacyChannelRow): Channel {
  return normalizeChannel(row);
}
