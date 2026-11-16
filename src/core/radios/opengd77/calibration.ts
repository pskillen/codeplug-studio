/**
 * OpenGD77 calibration working-copy layout (DM-1701 family and MD-9600): a 512-byte, byte-only
 * table that the firmware serves from RAM for reads inside flash 0x10000..0x101FF. Layout and
 * meanings read from two OpenGD77 source snapshots (DM-1701 family 2026-01-30, MD-9600
 * 2026-01-31); evidence (source file and line) is in each row's `evidence`. Never validated on
 * hardware. This is the OpenGD77 working copy, not stock factory calibration. Reference:
 * docs/reference/radios/opengd77/calibration.md and the per-model calibration.md under
 * docs/reference/radios/baofeng/dm-1701/ and docs/reference/radios/tyt/md-9600/.
 */

export const OPENGD77_CALIBRATION_LENGTH = 0x200;
export const OPENGD77_CALIBRATION_MARKER_OFFSET = 0x1b0;
export const OPENGD77_CALIBRATION_MARKER: readonly number[] = [
  0x00, 0x25, 0x00, 0x40, 0x00, 0x45, 0x01, 0x40,
];

/** What the slot at 0x1A0 / 0x1A9 means: it follows the firmware tree, so the model. */
export type OpenGd77CalibrationLowSlot = 'mid-low' | 'very-low';

/**
 * Confidence in a row's meaning. `traced`: the source names the field and its reader (or the
 * absence of one) was traced. `partly`: inferred, or the consumer is known but the stock meaning
 * is not. `unknown`: nothing established.
 */
export type OpenGd77CalibrationConfidence = 'traced' | 'partly' | 'unknown';

export interface OpenGd77CalibrationRow {
  id: string;
  group: string;
  label: string;
  band?: 'UHF' | 'VHF';
  offset: number;
  length: number;
  raw: Uint8Array;
  decoded?: string;
  layoutConfidence: 'source-declared';
  meaningConfidence: OpenGd77CalibrationConfidence;
  /** Raw unit or encoding of the stored bytes. */
  unit: string;
  /** What in OpenGD77 reads these bytes, or `none`. */
  consumer: string;
  /** False when nothing in OpenGD77 reads these bytes (shown as "not used by OpenGD77"). */
  hasReader: boolean;
  /** Source file and lines the meaning was traced from. */
  evidence: string;
  note?: string;
}

export interface OpenGd77CalibrationUnknownRange {
  offset: number;
  length: number;
  raw: Uint8Array;
  /** No OpenGD77 code reads these bytes; the stock meaning is unknown. */
  meaning: string;
}

export interface OpenGd77CalibrationDecode {
  markerPresent: boolean;
  rows: OpenGd77CalibrationRow[];
  /** Bytes in no named row: not used by OpenGD77, stock meaning unknown. */
  unknownRanges: OpenGd77CalibrationUnknownRange[];
}

export const OPENGD77_UNUSED_RANGE_MEANING = 'not used by OpenGD77; stock meaning unknown';

type Kind = 'bytes' | 'bcd-freq' | 'marker' | 'signed-trim';

interface Facts {
  unit: string;
  consumer: string;
  hasReader: boolean;
  evidence: string;
  note?: string;
  confidence?: OpenGd77CalibrationConfidence;
}

interface RowSpec extends Facts {
  id: string;
  group: string;
  label: string;
  band?: 'UHF' | 'VHF';
  offset: number;
  length: number;
  kind?: Kind;
}

const UHF_N = 9;
const VHF_N = 5;

/** A UHF[9] / VHF[5] pair of rows at the given offsets. */
function pair(
  id: string,
  group: string,
  label: string,
  uhf: number,
  vhf: number,
  facts: Facts,
): RowSpec[] {
  return [
    { id: `uhf-${id}`, group, label, band: 'UHF', offset: uhf, length: UHF_N, ...facts },
    { id: `vhf-${id}`, group, label, band: 'VHF', offset: vhf, length: VHF_N, ...facts },
  ];
}

const NO_READER = 'none (not used by OpenGD77)';
const stock = (what: string, evidence: string, note?: string): Facts => ({
  unit: `stock ${what}, raw bytes`,
  consumer: NO_READER,
  hasReader: false,
  evidence,
  ...(note ? { note } : {}),
});
const DAC16 = 'PA drive DAC code ÷ 16 (the firmware uses byte << 4 as a 12-bit DAC value)';
const IQ_UNIT = 'HR-C6000 page 4 register value, 0-255, no physical unit';
const SQUELCH_EVIDENCE = 'calibration.c, no references; OpenGD77 squelch is its own (trx.c)';
const DEVIATION_EVIDENCE = 'DM-1701 HR-C6000.c:2792-2840 (OpenGD77 hard-codes the deviation)';
const OSC_UNIT = 'offset binary: signed trim = byte - 128 (-128..127)';
const FREQ_UNIT = 'u32 little-endian BCD in 10 Hz units (MHz = digits ÷ 100000)';
const SCALED_1701 =
  'DM-1701: the working copy is scaled from the factory values at import (Low x1.00, Mid x0.85 VHF / x0.86 UHF, High x1.30 VHF / x1.70 UHF).';

const LOW_SLOT_LABEL: Record<OpenGd77CalibrationLowSlot, string> = {
  'mid-low': 'Mid-low power',
  'very-low': 'Very-low power',
};

/** The watt point each power slot calibrates, per model (`menuCalibration.c:58-70`, `trx.c`). */
const POWER_POINT = {
  high: { dm1701: '5 W', md9600: '40 W' },
  low: { dm1701: '1 W', md9600: '5 W' },
  mid: { dm1701: '2 W', md9600: '25 W' },
  lowSlot: { dm1701: '250 mW', md9600: '10 W' },
} as const;

function specs(lowSlot: OpenGd77CalibrationLowSlot): RowSpec[] {
  const dm = lowSlot === 'very-low';
  const watts = (k: keyof typeof POWER_POINT) => POWER_POINT[k][dm ? 'dm1701' : 'md9600'];
  const power = (k: keyof typeof POWER_POINT, note?: string): Facts => ({
    unit: `${DAC16}; the ${watts(k)} point`,
    consumer: 'calibrationGetPowerForFrequency, then trxUpdate_PA_DAC_Drive',
    hasReader: true,
    evidence: dm ? 'DM-1701 trx.c:806-919' : 'MD-9600 trx.c:825-865',
    ...(note ? { note } : {}),
  });
  const scaled = dm ? SCALED_1701 : undefined;
  const lowSlotNote = dm
    ? 'The meaning of this slot follows the model: the DM-1701 tree calls it very-low power and says the official firmware does not use it. OpenGD77 synthesises it from Low at import (x0.61 VHF, x0.65 UHF); 50 mW is this value minus 160 DAC counts (calibration.c:218-239).'
    : 'The meaning of this slot follows the model: the MD-9600 tree calls it mid-low power; the factory value is copied unchanged.';
  const rxTuning: Facts = dm
    ? {
        unit: 'stock RX tuning, raw bytes',
        consumer: NO_READER,
        hasReader: false,
        evidence: 'calibration.c:242 (no caller in the DM-1701 tree)',
        note: 'Read on the MD-9600 only.',
      }
    : {
        unit: 'varactor DAC code ÷ 16 (byte << 4), by RX frequency; UHF on DAC 1, VHF on DAC 2',
        consumer: 'trxUpdate (trx.c:924-928), then radioHardwareInterface.c:395-399',
        hasReader: true,
        evidence: 'MD-9600 trx.c:924-928, radioHardwareInterface.c:395-399',
      };
  const rxVoltage = (): Facts => ({
    confidence: 'partly',
    unit: 'unknown; the source says the exact use is unknown',
    consumer: 'none (battery voltage uses the ADC plus settings batteryCalibration)',
    hasReader: false,
    evidence: 'calibration.c:41-42; adc.c:85',
    note: 'No reader and no known meaning, even in the OpenGD77 source.',
  });

  const list: RowSpec[] = [
    {
      id: 'vox-level-1',
      group: 'Reference',
      label: 'VOX level 1',
      offset: 0x00,
      length: 1,
      ...stock('VOX threshold at setting 1', 'calibration.c:39-40, no references'),
    },
    {
      id: 'vox-level-10',
      group: 'Reference',
      label: 'VOX level 10',
      offset: 0x01,
      length: 1,
      ...stock('VOX threshold at setting 10', 'calibration.c:39-40, no references'),
    },
    {
      id: 'rx-low-voltage',
      group: 'Reference',
      label: 'RX low voltage',
      offset: 0x02,
      length: 1,
      ...rxVoltage(),
    },
    {
      id: 'rx-high-voltage',
      group: 'Reference',
      label: 'RX high voltage',
      offset: 0x03,
      length: 1,
      ...rxVoltage(),
    },
    {
      id: 'rssi-120',
      group: 'Reference',
      label: 'RSSI -120 dBm',
      offset: 0x04,
      length: 1,
      ...stock(
        'S-meter reference at -120 dBm',
        'calibration.c:615-622 (getter marked Not Used), menuRSSIScreen.c:83',
      ),
    },
    {
      id: 'rssi-70',
      group: 'Reference',
      label: 'RSSI -70 dBm',
      offset: 0x05,
      length: 1,
      ...stock(
        'S-meter reference at -70 dBm',
        'calibration.c:615-622 (getter marked Not Used), menuRSSIScreen.c:83',
      ),
    },
    {
      id: 'uhf-oscillator-tune',
      group: 'Oscillator',
      label: 'Oscillator tune',
      band: 'UHF',
      offset: 0x09,
      length: 1,
      kind: 'signed-trim',
      unit: OSC_UNIT,
      consumer:
        'trxUpdateC6000Calibration: HR-C6000 page 4 registers 0x47, 0x48 (sign) and 0x04, FM TX',
      hasReader: true,
      evidence: 'calibration.c:598-613, DM-1701 trx.c:962-976',
    },
    {
      id: 'vhf-oscillator-tune',
      group: 'Oscillator',
      label: 'Oscillator tune',
      band: 'VHF',
      offset: 0x0c,
      length: 1,
      kind: 'signed-trim',
      unit: OSC_UNIT,
      consumer: 'same as the UHF oscillator tune, VHF band',
      hasReader: true,
      evidence: 'calibration.c:600',
      note: 'The source comment calls this UHF; the getter maps VHF to this byte.',
    },
    ...pair(
      'high-power',
      'Power',
      `High power (${watts('high')} point)`,
      0x10,
      0x19,
      power('high', scaled),
    ),
    ...pair(
      'low-power',
      'Power',
      `Low power (${watts('low')} point)`,
      0x20,
      0x29,
      power('low', scaled),
    ),
    ...pair(
      'mid-power',
      'Power',
      `Mid power (${watts('mid')} point)`,
      0x190,
      0x199,
      power('mid', scaled),
    ),
    ...pair(
      'low-slot-power',
      'Power',
      `${LOW_SLOT_LABEL[lowSlot]} (${watts('lowSlot')} point)`,
      0x1a0,
      0x1a9,
      power('lowSlot', lowSlotNote),
    ),
    ...pair('rx-tuning', 'RX tuning', 'RX front-end tuning', 0x30, 0x39, rxTuning),
    ...pair(
      'squelch-open-9',
      'Squelch',
      'Squelch open, level 9',
      0x40,
      0xe0,
      stock('squelch threshold', SQUELCH_EVIDENCE),
    ),
    ...pair(
      'squelch-close-9',
      'Squelch',
      'Squelch close, level 9',
      0x50,
      0xe5,
      stock('squelch threshold', SQUELCH_EVIDENCE),
    ),
    ...pair(
      'squelch-open-1',
      'Squelch',
      'Squelch open, level 1',
      0x60,
      0xea,
      stock('squelch threshold', SQUELCH_EVIDENCE),
    ),
    ...pair(
      'squelch-close-1',
      'Squelch',
      'Squelch close, level 1',
      0x70,
      0xef,
      stock('squelch threshold', SQUELCH_EVIDENCE),
    ),
    ...pair(
      'ctcss-67',
      'CTCSS',
      'CTCSS deviation 67 Hz',
      0x90,
      0x9b,
      stock('CTCSS deviation', DEVIATION_EVIDENCE),
    ),
    ...pair(
      'ctcss-151',
      'CTCSS',
      'CTCSS deviation 151.4 Hz',
      0xa0,
      0xab,
      stock(
        'CTCSS deviation',
        DEVIATION_EVIDENCE,
        'The source comment gives the VHF offset as 0x9B; declaration order puts it at 0xAB.',
      ),
    ),
    ...pair(
      'ctcss-254',
      'CTCSS',
      'CTCSS deviation 254.1 Hz',
      0xb0,
      0xbb,
      stock('CTCSS deviation', DEVIATION_EVIDENCE),
    ),
    ...pair('dcs', 'DCS', 'DCS deviation', 0xd0, 0xdb, stock('DCS deviation', DEVIATION_EVIDENCE)),
    ...pair('dmr-i-gain', 'Gains', 'DMR I gain', 0x130, 0x139, {
      unit: `${IQ_UNIT} (register 0x45), by TX frequency`,
      consumer: 'HRC6000SetDMR',
      hasReader: true,
      evidence: 'DM-1701 HR-C6000.c:2869-2870',
    }),
    ...pair('dmr-q-gain', 'Gains', 'DMR Q gain', 0x140, 0x149, {
      unit: `${IQ_UNIT} (register 0x46), by TX frequency`,
      consumer: 'HRC6000SetDMR',
      hasReader: true,
      evidence: 'DM-1701 HR-C6000.c:2869-2870',
    }),
    ...pair('fm-i-gain', 'Gains', 'FM I gain', 0x170, 0x179, {
      unit: `${IQ_UNIT} (register 0x45), analogue TX`,
      consumer: 'HRC6000SetFMTx',
      hasReader: true,
      evidence: 'DM-1701 HR-C6000.c:2786-2787',
    }),
    ...pair('fm-q-gain', 'Gains', 'FM Q gain', 0x180, 0x189, {
      unit: `${IQ_UNIT} (register 0x46), analogue TX`,
      consumer: 'HRC6000SetFMTx',
      hasReader: true,
      evidence: 'DM-1701 HR-C6000.c:2786-2787',
    }),
  ];
  for (let i = 0; i < 10; i++) {
    list.push({
      id: `vhf-frequency-${i}`,
      group: 'Frequency points',
      label: `Frequency point ${Math.floor(i / 2)} ${i % 2 === 0 ? 'RX' : 'TX'}`,
      band: 'VHF',
      offset: 0x100 + i * 4,
      length: 4,
      kind: 'bcd-freq',
      confidence: 'partly',
      unit: FREQ_UNIT,
      consumer: 'none (OpenGD77 uses fixed frequency grids)',
      hasReader: false,
      evidence: 'inferred from the marker comment, calibration.c:170',
      note: 'Stock tuning point; the encoding is inferred.',
    });
  }
  for (let i = 0; i < 18; i++) {
    const marker = i < 2;
    list.push({
      id: `uhf-frequency-${i}`,
      group: 'Frequency points',
      label: marker
        ? `Entry ${i} (local marker position)`
        : `Frequency point ${Math.floor(i / 2)} ${i % 2 === 0 ? 'RX' : 'TX'}`,
      band: 'UHF',
      offset: 0x1b0 + i * 4,
      length: 4,
      kind: marker ? 'marker' : 'bcd-freq',
      confidence: 'partly',
      unit: FREQ_UNIT,
      consumer: marker
        ? 'only the local-marker check'
        : 'none (OpenGD77 uses fixed frequency grids)',
      hasReader: marker,
      evidence: marker
        ? 'calibration.c:169-181, inferred'
        : 'inferred from the marker comment, calibration.c:170',
      note: marker
        ? 'The OpenGD77 loader writes its marker over these eight bytes (400.02500 and 400.14500 MHz).'
        : 'Stock tuning point; the encoding is inferred.',
    });
  }
  return list;
}

const decimal = (bytes: Uint8Array) => Array.from(bytes).join(', ');

/** Little-endian BCD in 10 Hz units to MHz text, or `invalid BCD`. */
function bcdLeMhz(bytes: Uint8Array): string {
  let digits = '';
  for (let i = bytes.length - 1; i >= 0; i--) {
    const b = bytes[i]!;
    const hi = b >> 4;
    const lo = b & 0x0f;
    if (hi > 9 || lo > 9) return 'invalid BCD';
    digits += `${hi}${lo}`;
  }
  return `${(Number(digits) / 100000).toFixed(5)} MHz`;
}

/** Decode the 512-byte working copy into named rows; unnamed bytes come back as unused ranges. */
export function decodeOpenGd77Calibration(
  bytes: Uint8Array,
  lowSlot: OpenGd77CalibrationLowSlot,
): OpenGd77CalibrationDecode {
  if (bytes.length !== OPENGD77_CALIBRATION_LENGTH) {
    throw new RangeError(
      `OpenGD77 calibration must be ${OPENGD77_CALIBRATION_LENGTH} bytes, got ${bytes.length}`,
    );
  }
  const markerPresent = OPENGD77_CALIBRATION_MARKER.every(
    (value, i) => bytes[OPENGD77_CALIBRATION_MARKER_OFFSET + i] === value,
  );
  const covered = new Uint8Array(OPENGD77_CALIBRATION_LENGTH);
  const rows = specs(lowSlot)
    .sort((a, b) => a.offset - b.offset)
    .map((spec): OpenGd77CalibrationRow => {
      covered.fill(1, spec.offset, spec.offset + spec.length);
      const raw = bytes.slice(spec.offset, spec.offset + spec.length);
      let decoded: string | undefined;
      if (markerPresent) {
        if (spec.kind === 'bcd-freq') decoded = bcdLeMhz(raw);
        else if (spec.kind === 'marker') decoded = `OpenGD77 local marker: ${bcdLeMhz(raw)}`;
        else if (spec.kind === 'signed-trim') decoded = `${raw[0]! - 128} (byte ${raw[0]} - 128)`;
        else decoded = decimal(raw);
      }
      return {
        id: spec.id,
        group: spec.group,
        label: spec.label,
        ...(spec.band ? { band: spec.band } : {}),
        offset: spec.offset,
        length: spec.length,
        raw,
        ...(decoded === undefined ? {} : { decoded }),
        layoutConfidence: 'source-declared',
        meaningConfidence: spec.confidence ?? 'traced',
        unit: spec.unit,
        consumer: spec.consumer,
        hasReader: spec.hasReader,
        evidence: spec.evidence,
        ...(spec.note ? { note: spec.note } : {}),
      };
    });
  const unknownRanges: OpenGd77CalibrationDecode['unknownRanges'] = [];
  for (let i = 0; i < OPENGD77_CALIBRATION_LENGTH;) {
    if (covered[i]) {
      i++;
      continue;
    }
    let end = i;
    while (end < OPENGD77_CALIBRATION_LENGTH && !covered[end]) end++;
    unknownRanges.push({
      offset: i,
      length: end - i,
      raw: bytes.slice(i, end),
      meaning: OPENGD77_UNUSED_RANGE_MEANING,
    });
    i = end;
  }
  return { markerPresent, rows, unknownRanges };
}
