import type { ChannelModeProfileAnalog, ScanInclusion } from '@core/models/library.ts';
import type { ChannelTone } from '@core/models/libraryTypes.ts';
import { chirpPercentToWire, chirpWireToPercent } from './profiles.ts';

export {
  pickFmAmModeProfile as pickChirpAnalogueProfile,
  channelHasFmAmProfile as isChirpAnalogueExportable,
} from '@core/domain/modeProfiles.ts';

const CHIRP_DEFAULT_TONE_FREQ = '88.5';

/** CHIRP `Power` wire → internal percent via profile ladder. */
export function parseChirpPowerWire(wire: string, profileId: string): number | null {
  return chirpWireToPercent(profileId, wire);
}

export function formatChirpPowerWireForProfile(power: number | null, profileId: string): string {
  return chirpPercentToWire(profileId, power);
}

export function parseChirpModeWire(wire: string): {
  mode: 'fm' | 'am' | 'other';
  bandwidthKHz: number | null;
} {
  const key = wire.trim().toUpperCase();
  if (key === 'NFM') return { mode: 'fm', bandwidthKHz: 12.5 };
  if (key === 'FM') return { mode: 'fm', bandwidthKHz: 25 };
  if (key === 'AM') return { mode: 'am', bandwidthKHz: null };
  return { mode: 'other', bandwidthKHz: null };
}

export function formatChirpModeWire(
  mode: ChannelModeProfileAnalog['mode'],
  bandwidthKHz: number | null,
): string {
  if (mode === 'am') return 'AM';
  if (mode === 'fm' && bandwidthKHz != null && bandwidthKHz >= 20) return 'FM';
  if (mode === 'fm') return 'NFM';
  return 'NFM';
}

function normalizeToneValue(value: string | null | undefined): ChannelTone {
  const trimmed = (value ?? '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'none') return 'none';
  return trimmed as ChannelTone;
}

export function parseChirpTones(
  toneMode: string,
  rToneFreq: string,
  cToneFreq: string,
): { rxTone: ChannelTone; txTone: ChannelTone } {
  const mode = toneMode.trim().toUpperCase();
  const rFreq = rToneFreq.trim();
  const cFreq = cToneFreq.trim();

  if (!mode) {
    return { rxTone: 'none', txTone: 'none' };
  }

  if (mode === 'TSQL') {
    const tone = normalizeToneValue(cFreq);
    return { rxTone: tone, txTone: tone };
  }

  if (mode === 'TONE') {
    return {
      rxTone: 'none',
      txTone: normalizeToneValue(rFreq),
    };
  }

  return { rxTone: 'none', txTone: 'none' };
}

export function formatChirpToneColumns(
  rxTone: ChannelTone,
  txTone: ChannelTone,
): { tone: string; rToneFreq: string; cToneFreq: string } {
  if (rxTone !== 'none' && txTone !== 'none') {
    const freq = formatChirpToneFreq(rxTone);
    return { tone: 'TSQL', rToneFreq: CHIRP_DEFAULT_TONE_FREQ, cToneFreq: freq };
  }
  if (txTone !== 'none') {
    return {
      tone: 'Tone',
      rToneFreq: formatChirpToneFreq(txTone),
      cToneFreq: CHIRP_DEFAULT_TONE_FREQ,
    };
  }
  return {
    tone: '',
    rToneFreq: CHIRP_DEFAULT_TONE_FREQ,
    cToneFreq: CHIRP_DEFAULT_TONE_FREQ,
  };
}

export function formatChirpToneFreq(tone: ChannelTone): string {
  if (tone === 'none') return CHIRP_DEFAULT_TONE_FREQ;
  if (tone.startsWith('D')) return CHIRP_DEFAULT_TONE_FREQ;
  return tone;
}

export function parseChirpFrequencyWire(wire: string): number | null {
  const trimmed = wire.trim().replace(',', '.');
  if (!trimmed) return null;
  const mhz = parseFloat(trimmed);
  if (!Number.isFinite(mhz) || mhz <= 0) return null;
  return Math.round(mhz * 1_000_000);
}

export function formatChirpFrequencyWire(hz: number | null): string {
  if (hz == null || hz <= 0) return '';
  return (hz / 1_000_000).toFixed(6);
}

export function parseChirpOffsetMhz(wire: string): number {
  const trimmed = wire.trim().replace(',', '.');
  if (!trimmed) return 0;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : 0;
}

export function deriveChirpTxFrequencyHz(
  rxHz: number | null,
  duplex: string,
  offsetMhz: number,
): number | null {
  if (rxHz == null) return null;
  const d = duplex.trim().toLowerCase();
  if (d === 'off') return rxHz;
  const offsetHz = Math.round(offsetMhz * 1_000_000);
  if (d === '+') return rxHz + offsetHz;
  if (d === '-') return rxHz - offsetHz;
  return rxHz;
}

export function parseChirpDuplex(
  duplex: string,
  rxHz: number | null,
  offsetMhz: number,
): { txFrequency: number | null; forbidTransmit: boolean } {
  const d = duplex.trim().toLowerCase();
  if (d === 'off') {
    return { txFrequency: rxHz, forbidTransmit: true };
  }
  return {
    txFrequency: deriveChirpTxFrequencyHz(rxHz, duplex, offsetMhz),
    forbidTransmit: false,
  };
}

export function deriveChirpDuplexAndOffset(
  rxHz: number | null,
  txHz: number | null,
  forbidTransmit: boolean,
): { duplex: string; offsetMhz: number } {
  if (forbidTransmit) {
    return { duplex: 'off', offsetMhz: 0 };
  }
  if (rxHz == null || txHz == null || rxHz === txHz) {
    return { duplex: '', offsetMhz: 0 };
  }
  const diffHz = txHz - rxHz;
  const offsetMhz = Math.abs(diffHz) / 1_000_000;
  if (diffHz > 0) return { duplex: '+', offsetMhz };
  return { duplex: '-', offsetMhz };
}

/** CHIRP `Skip` column `S` means skip scan; empty means participate. */
export function scanInclusionFromChirpSkipColumn(wire: string): ScanInclusion {
  return wire.trim().toUpperCase() === 'S' ? 'skip' : 'alwaysScan';
}

/** TStep is ignored on import — export always emits `5.00`. */
export function formatChirpTStepWire(): string {
  return '5.00';
}
