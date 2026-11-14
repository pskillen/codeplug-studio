/**
 * Per-frame round-trip summary shared by the AT-D890UV firmware updater and the read-only link probe. A pure helper
 * with no port or write code, so the probe can use it without importing the flasher.
 */
import type { FirmwareFlashTiming } from '../../../firmware/types.ts';

/** Median, p99 and max of the first `count` samples. */
export function summariseD890FrameTiming(
  samples: Float64Array,
  count: number,
): FirmwareFlashTiming | undefined {
  if (count <= 0) return undefined;
  const sorted = samples.slice(0, count).sort();
  const at = (q: number) => sorted[Math.min(count - 1, Math.ceil(q * count) - 1)]!;
  const round = (ms: number) => Math.round(ms * 100) / 100;
  return {
    medianFrameMs: round(at(0.5)),
    p99FrameMs: round(at(0.99)),
    maxFrameMs: round(sorted[count - 1]!),
  };
}
