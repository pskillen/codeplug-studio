import type { ChannelModeProfileAnalog, ScanInclusion } from '@core/models/library.ts';
import type { ChannelTone } from '@core/models/libraryTypes.ts';
import { chirpPercentToWire, chirpWireToPercent } from './profiles.ts';

export {
  pickFmAmModeProfile as pickChirpAnalogueProfile,
  channelHasFmAmProfile as isChirpAnalogueExportable,
} from '@core/domain/modeProfiles.ts';

const CHIRP_DEFAULT_TONE_FREQ = '88.5';
const CHIRP_DEFAULT_DTCS_CODE = '023';
const CHIRP_DEFAULT_CROSS_MODE = 'Tone->Tone';

type ChirpToneKind = 'none' | 'Tone' | 'DTCS';

interface ClassifiedChirpTone {
  kind: ChirpToneKind;
  /** CTCSS Hz string, or unused. */
  ctcssFreq: string;
  /** Zero-padded 3-digit DTCS code. */
  dtcsCode: string;
  /** CHIRP polarity wire `N` or `R` (Studio `P` → `R`). */
  dtcsPolarity: 'N' | 'R';
}

export interface ChirpToneWireColumns {
  tone: string;
  rToneFreq: string;
  cToneFreq: string;
  dtcsCode: string;
  dtcsPolarity: string;
  rxDtcsCode: string;
  crossMode: string;
}

function chirpDtcsDefaults(): Pick<
  ChirpToneWireColumns,
  'dtcsCode' | 'dtcsPolarity' | 'rxDtcsCode' | 'crossMode'
> {
  return {
    dtcsCode: CHIRP_DEFAULT_DTCS_CODE,
    dtcsPolarity: 'NN',
    rxDtcsCode: CHIRP_DEFAULT_DTCS_CODE,
    crossMode: CHIRP_DEFAULT_CROSS_MODE,
  };
}

/** Classify Studio `ChannelTone` (`none` | CTCSS Hz | `D023N`) for CHIRP export. */
export function classifyChirpTone(tone: ChannelTone): ClassifiedChirpTone {
  if (tone === 'none' || !tone.trim()) {
    return {
      kind: 'none',
      ctcssFreq: CHIRP_DEFAULT_TONE_FREQ,
      dtcsCode: CHIRP_DEFAULT_DTCS_CODE,
      dtcsPolarity: 'N',
    };
  }
  const trimmed = tone.trim();
  const dcs = /^D(\d{1,3})([NP]?)$/i.exec(trimmed);
  if (dcs) {
    const code = Number.parseInt(dcs[1]!, 10);
    const studioPol = (dcs[2]?.toUpperCase() || 'N') as 'N' | 'P';
    return {
      kind: 'DTCS',
      ctcssFreq: CHIRP_DEFAULT_TONE_FREQ,
      dtcsCode: String(code).padStart(3, '0'),
      dtcsPolarity: studioPol === 'P' ? 'R' : 'N',
    };
  }
  return {
    kind: 'Tone',
    ctcssFreq: trimmed,
    dtcsCode: CHIRP_DEFAULT_DTCS_CODE,
    dtcsPolarity: 'N',
  };
}

function chirpDtcsPolarityPair(tx: ClassifiedChirpTone, rx: ClassifiedChirpTone): string {
  const txPol = tx.kind === 'DTCS' ? tx.dtcsPolarity : 'N';
  const rxPol = rx.kind === 'DTCS' ? rx.dtcsPolarity : 'N';
  return `${txPol}${rxPol}`;
}

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

/**
 * Map Studio RX/TX tones to CHIRP tone columns (mirrors `split_tone_decode` in chirp_common.py).
 * Unused CTCSS cells are `88.5`; unused DTCS cells keep CHIRP Memory defaults (`023` / `Tone->Tone`).
 */
export function formatChirpToneColumns(
  rxTone: ChannelTone,
  txTone: ChannelTone,
): ChirpToneWireColumns {
  const tx = classifyChirpTone(txTone);
  const rx = classifyChirpTone(rxTone);
  const polarity = chirpDtcsPolarityPair(tx, rx);
  const defaults = chirpDtcsDefaults();

  if (tx.kind === 'none' && rx.kind === 'none') {
    return {
      tone: '',
      rToneFreq: CHIRP_DEFAULT_TONE_FREQ,
      cToneFreq: CHIRP_DEFAULT_TONE_FREQ,
      ...defaults,
    };
  }

  if (tx.kind === 'Tone' && rx.kind === 'none') {
    return {
      tone: 'Tone',
      rToneFreq: tx.ctcssFreq,
      cToneFreq: CHIRP_DEFAULT_TONE_FREQ,
      ...defaults,
      dtcsPolarity: polarity,
    };
  }

  if (tx.kind === 'Tone' && rx.kind === 'Tone' && tx.ctcssFreq === rx.ctcssFreq) {
    return {
      tone: 'TSQL',
      rToneFreq: CHIRP_DEFAULT_TONE_FREQ,
      cToneFreq: tx.ctcssFreq,
      ...defaults,
      dtcsPolarity: polarity,
    };
  }

  if (tx.kind === 'DTCS' && rx.kind === 'DTCS' && tx.dtcsCode === rx.dtcsCode) {
    return {
      tone: 'DTCS',
      rToneFreq: CHIRP_DEFAULT_TONE_FREQ,
      cToneFreq: CHIRP_DEFAULT_TONE_FREQ,
      dtcsCode: tx.dtcsCode,
      dtcsPolarity: polarity,
      rxDtcsCode: CHIRP_DEFAULT_DTCS_CODE,
      crossMode: CHIRP_DEFAULT_CROSS_MODE,
    };
  }

  // Cross — including RX-only, TX-only DTCS, mismatched CTCSS, and CTCSS↔DCS mixes
  const crossMode = `${tx.kind === 'none' ? '' : tx.kind}->${rx.kind === 'none' ? '' : rx.kind}`;
  return {
    tone: 'Cross',
    rToneFreq: tx.kind === 'Tone' ? tx.ctcssFreq : CHIRP_DEFAULT_TONE_FREQ,
    cToneFreq: rx.kind === 'Tone' ? rx.ctcssFreq : CHIRP_DEFAULT_TONE_FREQ,
    dtcsCode: tx.kind === 'DTCS' ? tx.dtcsCode : CHIRP_DEFAULT_DTCS_CODE,
    dtcsPolarity: polarity,
    rxDtcsCode: rx.kind === 'DTCS' ? rx.dtcsCode : CHIRP_DEFAULT_DTCS_CODE,
    crossMode,
  };
}

/** CTCSS Hz for unused/default cells; DCS tones are not written into frequency columns. */
export function formatChirpToneFreq(tone: ChannelTone): string {
  const classified = classifyChirpTone(tone);
  if (classified.kind === 'Tone') return classified.ctcssFreq;
  return CHIRP_DEFAULT_TONE_FREQ;
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
