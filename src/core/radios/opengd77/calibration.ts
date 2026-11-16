/**
 * OpenGD77 calibration working-copy layout (DM-1701 family and MD-9600): a 512-byte, byte-only
 * table that the firmware serves from RAM for reads inside flash 0x10000..0x101FF. Layout read
 * from two OpenGD77 source snapshots (DM-1701 family 2026-01-30, MD-9600 2026-01-31); never
 * validated on hardware. This is the OpenGD77 working copy, not stock factory calibration.
 * Raw values carry no physical unit here and nothing in this module judges them. Reference:
 * docs/reference/radios/opengd77/calibration.md.
 */

export const OPENGD77_CALIBRATION_LENGTH = 0x200;
export const OPENGD77_CALIBRATION_MARKER_OFFSET = 0x1b0;
export const OPENGD77_CALIBRATION_MARKER: readonly number[] = [
  0x00, 0x25, 0x00, 0x40, 0x00, 0x45, 0x01, 0x40,
];

/** What the slot at 0x1A0 / 0x1A9 means: it follows the firmware tree, so the model. */
export type OpenGd77CalibrationLowSlot = 'mid-low' | 'very-low';

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
  meaningConfidence: 'named' | 'partial' | 'unknown';
  note?: string;
}

export interface OpenGd77CalibrationDecode {
  markerPresent: boolean;
  rows: OpenGd77CalibrationRow[];
  unknownRanges: { offset: number; length: number; raw: Uint8Array }[];
}

type Kind = 'bytes' | 'bcd' | 'marker';

interface RowSpec {
  id: string;
  group: string;
  label: string;
  band?: 'UHF' | 'VHF';
  offset: number;
  length: number;
  kind?: Kind;
  meaning?: 'named' | 'partial';
  note?: string;
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
  note?: string,
): RowSpec[] {
  return [
    { id: `uhf-${id}`, group, label, band: 'UHF', offset: uhf, length: UHF_N, note },
    { id: `vhf-${id}`, group, label, band: 'VHF', offset: vhf, length: VHF_N, note },
  ];
}

const LOW_SLOT_LABEL: Record<OpenGd77CalibrationLowSlot, string> = {
  'mid-low': 'Mid-low power',
  'very-low': 'Very-low power',
};
const LOW_SLOT_NOTE: Record<OpenGd77CalibrationLowSlot, string> = {
  'mid-low': 'The meaning of this slot follows the model: the MD-9600 tree calls it mid-low power.',
  'very-low':
    'The meaning of this slot follows the model: the DM-1701 tree calls it very-low power and says the official firmware does not use it.',
};

function specs(lowSlot: OpenGd77CalibrationLowSlot): RowSpec[] {
  const list: RowSpec[] = [
    { id: 'vox-level-1', group: 'Reference', label: 'VOX level 1', offset: 0x00, length: 1 },
    { id: 'vox-level-10', group: 'Reference', label: 'VOX level 10', offset: 0x01, length: 1 },
    {
      id: 'rx-low-voltage',
      group: 'Reference',
      label: 'RX low voltage',
      offset: 0x02,
      length: 1,
      meaning: 'partial',
      note: 'The source says the exact use is unknown.',
    },
    {
      id: 'rx-high-voltage',
      group: 'Reference',
      label: 'RX high voltage',
      offset: 0x03,
      length: 1,
      meaning: 'partial',
      note: 'The source says the exact use is unknown.',
    },
    { id: 'rssi-120', group: 'Reference', label: 'RSSI -120 dBm', offset: 0x04, length: 1 },
    { id: 'rssi-70', group: 'Reference', label: 'RSSI -70 dBm', offset: 0x05, length: 1 },
    {
      id: 'uhf-oscillator-tune',
      group: 'Oscillator',
      label: 'Oscillator tune',
      band: 'UHF',
      offset: 0x09,
      length: 1,
    },
    {
      id: 'vhf-oscillator-tune',
      group: 'Oscillator',
      label: 'Oscillator tune',
      band: 'VHF',
      offset: 0x0c,
      length: 1,
      note: 'The source comment calls this UHF; declaration order puts it in the VHF position.',
    },
    ...pair('high-power', 'Power', 'High power', 0x10, 0x19),
    ...pair('low-power', 'Power', 'Low power', 0x20, 0x29),
    ...pair('mid-power', 'Power', 'Mid power', 0x190, 0x199),
    ...pair(
      'low-slot-power',
      'Power',
      LOW_SLOT_LABEL[lowSlot],
      0x1a0,
      0x1a9,
      LOW_SLOT_NOTE[lowSlot],
    ),
    ...pair('rx-tuning', 'RX tuning', 'RX front-end tuning', 0x30, 0x39),
    ...pair('squelch-open-9', 'Squelch', 'Squelch open, level 9', 0x40, 0xe0),
    ...pair('squelch-close-9', 'Squelch', 'Squelch close, level 9', 0x50, 0xe5),
    ...pair('squelch-open-1', 'Squelch', 'Squelch open, level 1', 0x60, 0xea),
    ...pair('squelch-close-1', 'Squelch', 'Squelch close, level 1', 0x70, 0xef),
    ...pair('ctcss-67', 'CTCSS', 'CTCSS deviation 67 Hz', 0x90, 0x9b),
    ...pair(
      'ctcss-151',
      'CTCSS',
      'CTCSS deviation 151.4 Hz',
      0xa0,
      0xab,
      'The source comment gives the VHF offset as 0x9B; declaration order puts it at 0xAB.',
    ),
    ...pair('ctcss-254', 'CTCSS', 'CTCSS deviation 254.1 Hz', 0xb0, 0xbb),
    ...pair('dcs', 'DCS', 'DCS deviation', 0xd0, 0xdb),
    ...pair('dmr-i-gain', 'Gains', 'DMR I gain', 0x130, 0x139),
    ...pair('dmr-q-gain', 'Gains', 'DMR Q gain', 0x140, 0x149),
    ...pair('fm-i-gain', 'Gains', 'FM I gain', 0x170, 0x179),
    ...pair('fm-q-gain', 'Gains', 'FM Q gain', 0x180, 0x189),
  ];
  for (let i = 0; i < 10; i++) {
    list.push({
      id: `vhf-frequency-${i}`,
      group: 'Frequency points',
      label: `Frequency point ${Math.floor(i / 2)} ${i % 2 === 0 ? 'RX' : 'TX'}`,
      band: 'VHF',
      offset: 0x100 + i * 4,
      length: 4,
      kind: 'bcd',
      meaning: 'partial',
      note: 'Stored digits only; no unit is claimed.',
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
      kind: marker ? 'marker' : 'bcd',
      meaning: 'partial',
      note: marker
        ? 'The OpenGD77 loader writes its marker over these eight bytes.'
        : 'Stored digits only; no unit is claimed.',
    });
  }
  return list;
}

const decimal = (bytes: Uint8Array) => Array.from(bytes).join(', ');

function bcd(bytes: Uint8Array): string {
  let digits = '';
  for (const b of bytes) {
    const hi = b >> 4;
    const lo = b & 0x0f;
    if (hi > 9 || lo > 9) return 'invalid BCD';
    digits += `${hi}${lo}`;
  }
  return digits;
}

/** Decode the 512-byte working copy into named rows; unnamed bytes come back as unknown ranges. */
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
        decoded =
          spec.kind === 'bcd'
            ? bcd(raw)
            : spec.kind === 'marker'
              ? 'OpenGD77 local marker, not a frequency'
              : decimal(raw);
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
        meaningConfidence: spec.meaning ?? 'named',
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
    unknownRanges.push({ offset: i, length: end - i, raw: bytes.slice(i, end) });
    i = end;
  }
  return { markerPresent, rows, unknownRanges };
}
