import type { ChannelTone } from '@core/models/libraryTypes.ts';

/** Format repeater / numeric CTCSS Hz as a library tone string (one decimal when whole). */
export function formatCtcssHz(hz: number): ChannelTone {
  if (!Number.isFinite(hz) || hz <= 0) return 'none';
  const oneDecimal = Math.round(hz * 10) / 10;
  const str = oneDecimal.toString();
  return str.includes('.') ? str : `${str}.0`;
}

export type DcsPolarity = 'N' | 'I';

export type ParsedChannelTone =
  | { kind: 'none' }
  | { kind: 'ctcss'; hz: number }
  | { kind: 'dcs'; code: number; polarity: DcsPolarity }
  | { kind: 'unknown' };

const DCS_TONE = /^D(\d{1,3})([NIP])?$/i;
const CTCSS_HZ = /^\d+(\.\d+)?$/;

/**
 * Classify a library tone string.
 * `D###N` is normal DCS. `D###I` is inverted. Legacy `D###P` is also inverted.
 * A string that is neither Off, CTCSS Hz, nor DCS stays `unknown` so callers do not coerce it to Off.
 */
export function parseChannelTone(tone: ChannelTone | null | undefined): ParsedChannelTone {
  const trimmed = (tone ?? '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'none') return { kind: 'none' };

  const dcs = DCS_TONE.exec(trimmed);
  if (dcs) {
    const code = Number.parseInt(dcs[1]!, 10);
    const suffix = (dcs[2] ?? 'N').toUpperCase();
    const polarity: DcsPolarity = suffix === 'I' || suffix === 'P' ? 'I' : 'N';
    return { kind: 'dcs', code, polarity };
  }

  if (CTCSS_HZ.test(trimmed)) {
    const hz = Number.parseFloat(trimmed);
    if (Number.isFinite(hz) && hz > 0) return { kind: 'ctcss', hz };
  }

  return { kind: 'unknown' };
}

/** Canonical library DCS string: `D023N` or `D023I`. */
export function formatDcsChannelTone(code: number, polarity: DcsPolarity): ChannelTone {
  return `D${String(code).padStart(3, '0')}${polarity}`;
}

/**
 * Rewrite a legacy inverted suffix `P` to canonical `I`.
 * `D023N`, `D023I`, CTCSS, and Off pass through unchanged.
 */
export function canonicalDcsChannelTone(tone: ChannelTone): ChannelTone {
  const trimmed = tone.trim();
  if (!/P$/i.test(trimmed)) return tone;
  const parsed = parseChannelTone(trimmed);
  if (parsed.kind !== 'dcs' || parsed.polarity !== 'I') return tone;
  return formatDcsChannelTone(parsed.code, 'I');
}
