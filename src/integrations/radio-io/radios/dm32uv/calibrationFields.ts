/**
 * DM-32UV calibration field registry (firmware 048): one place for offsets, widths, consumer
 * addresses and confidence, plus the one live-page selection shared with Compare.
 * Pure: no React. Decoded text is built from `decodeDm32CalibrationPage` /
 * `decodeDm32FactorySector` so there is no second BCD implementation.
 */
import {
  decodeDm32CalibrationPage,
  decodeDm32FactorySector,
  DM32_CALIBRATION_JSON_PATH,
  DM32_FACTORY_JSON_PATH,
  DM32_FACTORY_SECTOR_REGION_ID,
  type Dm32CalibrationPageDecode,
  type Dm32FactorySectorDecode,
} from './calibrationDecode.ts';
import { DM32_BLOCK_SIZE, DM32_FACTORY_SECTOR_LENGTH } from './constants.ts';
import { classifyDm32DebugCoverage, type Dm32DebugCoverage } from './debugCoverage.ts';
import type { Dm32CompareArchive } from './debugCompare.ts';

/** Firmware the layout was traced on. MM9PDY or other stock builds are not assumed to match. */
export const DM32_CALIBRATION_BASIS_FIRMWARE = 'DM32.01.L01.048';

export type Dm32CalibrationConfidence = 'traced' | 'partially-traced' | 'unknown';

export interface Dm32CalibrationRow {
  id: string;
  group: string;
  label: string;
  offset: number;
  length: number;
  raw: Uint8Array;
  /** Absent when the field is shown as raw bytes only. */
  decoded?: string;
  /** Why a value is not decoded, or is not trustworthy (invalid BCD, out of range). */
  reason?: string;
  /** The matching `decodeDm32CalibrationPage` / `decodeDm32FactorySector` field, for drift tests. */
  value?: unknown;
  layoutConfidence: Dm32CalibrationConfidence;
  meaningConfidence: Dm32CalibrationConfidence;
  /** Firmware consumer address(es), or why none is known. */
  source: string;
  note?: string;
}

interface Formatted {
  text: string;
  reason?: string;
}

interface PageSpec {
  id: string;
  group: string;
  label: string;
  offset: number;
  length: number;
  layout: Dm32CalibrationConfidence;
  meaning: Dm32CalibrationConfidence;
  source: string;
  note?: string;
  value?: (d: Dm32CalibrationPageDecode) => unknown;
  format?: (value: never) => Formatted;
}

const INVALID_BCD = 'invalid BCD';
const mhz = (hz: number | null, places?: number) =>
  hz === null ? INVALID_BCD : `${places === undefined ? hz / 1e6 : (hz / 1e6).toFixed(places)}`;

const fmtBand = (v: { lowHz: number | null; highHz: number | null }): Formatted => ({
  text: `${mhz(v.lowHz)} – ${mhz(v.highHz)} MHz`,
  reason:
    v.lowHz === null || v.highHz === null
      ? 'A nibble is not BCD, so the limit is not decoded; raw bytes are shown.'
      : undefined,
});

const fmtPoints = (v: (number | null)[]): Formatted => {
  const bad = v.flatMap((p, i) => (p === null ? [i + 1] : []));
  return {
    text: `${v.map((p) => mhz(p, 5)).join(', ')} MHz`,
    reason: bad.length
      ? `Point ${bad.join(', ')}: a nibble is not BCD, so it is not decoded; raw bytes are shown.`
      : undefined,
  };
};

const fmtBytes = (v: number[]): Formatted => ({ text: v.join(' ') });

/** The battery ADC scale at +0x00E: masked 0xFFF, 1–1000 else the firmware default 0x284. */
const fmtBatteryScale = (v: { scale: number; scaleValid: boolean }): Formatted => ({
  text: `${v.scale}`,
  reason: v.scaleValid
    ? undefined
    : `Masked value ${v.scale} is outside 1–1000; the firmware uses its default 0x284 (644) instead.`,
});

const fmtNumber = (v: number): Formatted => ({ text: `${v}` });

const BOOT = '0x0300D518';

/** Page fields traced in firmware 048, in table order. */
const PAGE_SPECS: readonly PageSpec[] = [
  {
    id: 'uhf-band',
    group: 'Band limits',
    label: 'UHF band low / high',
    offset: 0x000,
    length: 4,
    layout: 'traced',
    meaning: 'traced',
    source: `Band table 0x00038470, boot read ${BOOT}`,
    note: 'Interpolation domain only; not a transmit limit.',
    value: (d) => d.uhfBand,
    format: fmtBand,
  },
  {
    id: 'vhf-band',
    group: 'Band limits',
    label: 'VHF band low / high',
    offset: 0x0cc,
    length: 4,
    layout: 'traced',
    meaning: 'traced',
    source: `Band table 0x00038470, boot read ${BOOT}`,
    note: 'Interpolation domain only; not a transmit limit.',
    value: (d) => d.vhfBand,
    format: fmtBand,
  },
  ...(
    [
      ['uhf-rx', 'UHF RX', 0x300, 'uhfRx'],
      ['uhf-tx', 'UHF TX', 0x314, 'uhfTx'],
      ['vhf-rx', 'VHF RX', 0x328, 'vhfRx'],
      ['vhf-tx', 'VHF TX', 0x33c, 'vhfTx'],
    ] as const
  ).map(([id, label, offset, key]): PageSpec => ({
    id: `points-${id}`,
    group: 'Frequency points',
    label: `${label} frequency points (5)`,
    offset,
    length: 20,
    layout: 'traced',
    meaning: 'traced',
    source: '0x0301A314, 0x0301A3A0',
    value: (d) => d.frequencyPointsHz[key],
    format: fmtPoints,
  })),
  ...(
    [
      ['uhf', 'UHF', [0x040, 0x045, 0x04a]],
      ['vhf', 'VHF', [0x0d0, 0x0d5, 0x0da]],
    ] as const
  ).flatMap(([band, label, offsets]) =>
    (['low', 'mid', 'high'] as const).map((level, i): PageSpec => ({
      id: `power-${band}-${level}`,
      group: 'TX power',
      label: `${label} TX power ${level}`,
      offset: offsets[i]!,
      length: 5,
      layout: 'traced',
      meaning: 'traced',
      source: '0x0301A7C4, adjust group 0 (0x03053834)',
      note: 'TX power drive per frequency point (adjust mode sends v x 16 to DAC 0x140F000C). Bytes as stored; watts unknown.',
      value: (d) => (band === 'uhf' ? d.uhfPower : d.vhfPower)[level],
      format: fmtBytes,
    })),
  ),
  ...(
    [
      [
        'uhf-0',
        'UHF level pair 1',
        0x064,
        0x069,
        (d: Dm32CalibrationPageDecode) => d.levels.uhf[0],
      ],
      [
        'uhf-1',
        'UHF level pair 2',
        0x06e,
        0x073,
        (d: Dm32CalibrationPageDecode) => d.levels.uhf[1],
      ],
      [
        'vhf-0',
        'VHF level pair 1',
        0x0e0,
        0x0e5,
        (d: Dm32CalibrationPageDecode) => d.levels.vhf[0],
      ],
      [
        'vhf-1',
        'VHF level pair 2',
        0x0ea,
        0x0ef,
        (d: Dm32CalibrationPageDecode) => d.levels.vhf[1],
      ],
      [
        'air',
        '108–136 MHz level pair',
        0x080,
        0x085,
        (d: Dm32CalibrationPageDecode) => d.levels.airband,
      ],
    ] as const
  ).flatMap(([id, label, first, second, pick]) =>
    (['level1', 'level9'] as const).map((which, i): PageSpec => ({
      id: `level-${id}-${which}`,
      group: 'Level pairs',
      label: `${label}, level ${which === 'level1' ? 1 : 9}`,
      offset: i === 0 ? first : second,
      length: 5,
      layout: 'traced',
      meaning: 'traced',
      source: '0x0301A5B4, 0x0300DE28 (adjust groups 9-12)',
      note: 'Squelch thresholds at squelch levels 1 and 9, interpolated by the channel squelch; written to RF register 0x78. Bytes as stored; units are raw RF threshold units.',
      value: (d) => pick(d)![which],
      format: fmtBytes,
    })),
  ),
  {
    id: 'scalar-00c',
    group: 'Scalars',
    label: 'Battery threshold',
    offset: 0x00c,
    length: 2,
    layout: 'traced',
    meaning: 'traced',
    source: '0x0300D518, 0x0301AEDC',
    note: 'u16 little-endian, stored raw: no mask and no range check (that rule is +0x00E only). Compared against the scaled battery voltage (10 mV units, inferred).',
    value: (d) => d.battery.thresholdRaw,
    format: fmtNumber as (value: never) => Formatted,
  },
  {
    id: 'scalar-00e',
    group: 'Scalars',
    label: 'Battery ADC scale (masked 0xFFF)',
    offset: 0x00e,
    length: 2,
    layout: 'traced',
    meaning: 'traced',
    source: '0x0300D518, 0x0301AEDC, adjust Save 0x03053840',
    note: 'u16 little-endian masked 0xFFF; valid 1–1000, otherwise the firmware default 0x284 (644). Voltage = raw x 750 / scale, so it is the battery ADC count at the 7.50 V reference (inferred from the formula).',
    value: (d) => ({ scale: d.battery.scale, scaleValid: d.battery.scaleValid }),
    format: fmtBatteryScale,
  },
  {
    id: 'boot-016',
    group: 'Boot scalars',
    label: 'Modem scalar (register 0x11000108 bytes 3, 2)',
    offset: 0x016,
    length: 1,
    layout: 'traced',
    meaning: 'traced',
    source: '0x030208D4 (adjust group 1)',
    note: 'Written to modem register 0x11000108; the register has no name.',
  },
  {
    id: 'boot-027',
    group: 'Boot scalars',
    label: 'Modem scalar (register 0x11000114 high halfword)',
    offset: 0x027,
    length: 2,
    layout: 'traced',
    meaning: 'traced',
    source: '0x030208B8, 0x03037138 (adjust group 4)',
    note: 'u16 little-endian, 10 bits used (adjust clamps to 0x400). The register has no name.',
    value: (d) => d.words.at0x027,
    format: fmtNumber as (value: never) => Formatted,
  },
  {
    id: 'boot-201',
    group: 'Boot scalars',
    label: 'CTCSS / DCS TX level',
    offset: 0x201,
    length: 2,
    layout: 'traced',
    meaning: 'traced',
    source: '0x0301A9FC, adjust groups 6, 7',
    note: '+0x201 CTCSS TX level, +0x202 DCS TX level; both go to RF register 0x51 (OR 0x9000 / 0x8000).',
  },
  {
    id: 'boot-203',
    group: 'Boot scalars',
    label: 'Boot values loaded to RAM (7 bytes)',
    offset: 0x203,
    length: 7,
    layout: 'traced',
    meaning: 'unknown',
    source: '0x0301A9FC, 0x0300D518',
    note: 'Loaded to 0x38470[0x35..0x40]; no consumer found. +0x203 and +0x204 are at most 31, +0x205 is a nibble, +0x206 to +0x209 use 5, 7, 4 and 4 bits.',
  },
  {
    id: 'audio-level-analog',
    group: 'Audio levels',
    label: 'Audio level, analogue / FM',
    offset: 0x20a,
    length: 1,
    layout: 'traced',
    meaning: 'traced',
    source: '0x030541AC',
    note: 'Range 1..15, default 13. Raw level, no unit.',
  },
  {
    id: 'audio-level-digital',
    group: 'Audio levels',
    label: 'Audio level, digital',
    offset: 0x20b,
    length: 1,
    layout: 'traced',
    meaning: 'traced',
    source: '0x030541AC',
    note: 'Range 1..63, default 39. Raw level, no unit.',
  },
  {
    id: 'adc-channel-1',
    group: 'ADC calibration',
    label: 'ADC channel 1 count (+0x07A)',
    offset: 0x07a,
    length: 2,
    layout: 'traced',
    meaning: 'partially-traced',
    source: '0x03053880, 0x03036EB4',
    note: 'u16 little-endian; written by the adjust Save (item O stores to +0x07A, any other item to +0x07C) with a 4-sample ADC channel 1 average. No runtime reader found. Raw ADC count.',
    value: (d) => d.words.at0x07a,
    format: fmtNumber as (value: never) => Formatted,
  },
  {
    id: 'adc-channel-1-b',
    group: 'ADC calibration',
    label: 'ADC channel 1 count (+0x07C)',
    offset: 0x07c,
    length: 2,
    layout: 'traced',
    meaning: 'partially-traced',
    source: '0x03053880, 0x03036EB4',
    note: 'Companion of +0x07A, written by the same adjust Save; no runtime reader found. Raw ADC count.',
    value: (d) => d.words.at0x07c,
    format: fmtNumber as (value: never) => Formatted,
  },
  {
    id: 'table5-uhf',
    group: 'Tables',
    label: 'UHF 5-point table',
    offset: 0x017,
    length: 5,
    layout: 'traced',
    meaning: 'traced',
    source: '0x0301A4D0, adjust group 2 (0x0305381C)',
    note: 'Per-TX-frequency value written to modem register 0x11000114 low halfword in analogue mode (modulation level, name inferred). Raw.',
  },
  {
    id: 'table5-vhf',
    group: 'Tables',
    label: 'VHF 5-point table',
    offset: 0x0a6,
    length: 5,
    layout: 'traced',
    meaning: 'traced',
    source: '0x0301A4D0, adjust group 2 (0x0305381C)',
    note: 'Per-TX-frequency value written to modem register 0x11000114 low halfword in analogue mode (modulation level, name inferred). Raw.',
  },
  {
    id: 'table3-uhf',
    group: 'Tables',
    label: 'UHF 3-point table',
    offset: 0x01c,
    length: 3,
    layout: 'traced',
    meaning: 'traced',
    source: '0x0301A418, 0x0300DE10, adjust group 5',
    note: 'Per-TX-frequency value written to RF register 0x40 (OR 0x3400). Adjust group 5 also addresses the three bytes before it. Raw.',
  },
  {
    id: 'table3-vhf',
    group: 'Tables',
    label: 'VHF 3-point table',
    offset: 0x0ab,
    length: 3,
    layout: 'traced',
    meaning: 'traced',
    source: '0x0301A418, 0x0300DE10, adjust group 5',
    note: 'Per-TX-frequency value written to RF register 0x40 (OR 0x3400). Adjust group 5 also addresses the three bytes before it. Raw.',
  },
  {
    id: 'adjust-uhf',
    group: 'Adjust-mode test frequencies (observed)',
    label: 'Three frequencies, UHF side',
    offset: 0x030,
    length: 12,
    layout: 'traced',
    meaning: 'unknown',
    source: 'No reader in 048 (0x03029A3C reads +0x300–+0x34F, not these)',
    note: 'Three BCD frequencies near 400, 435 and 470 MHz (observed); no firmware reader. Raw only.',
  },
  {
    id: 'adjust-vhf',
    group: 'Adjust-mode test frequencies (observed)',
    label: 'Three frequencies, second set',
    offset: 0x150,
    length: 12,
    layout: 'traced',
    meaning: 'unknown',
    source: 'No reader in 048 (0x03029A3C reads +0x300–+0x34F, not these)',
    note: 'Three BCD frequencies near 400, 435 and 470 MHz (observed); no firmware reader. Raw only.',
  },
  ...(
    [
      [0x0c0, 12],
      [0x188, 12],
      [0x210, 6],
    ] as const
  ).map(([offset, length]): PageSpec => ({
    id: `unknown-${offset.toString(16).padStart(3, '0')}`,
    group: 'Unknown',
    label: 'Present, purpose unexplained',
    offset,
    length,
    layout: 'unknown',
    meaning: 'unknown',
    source: 'No reader in 048 (constant and computed reads both checked)',
  })),
];

const hex2 = (n: number) => `0x${n.toString(16).toUpperCase().padStart(2, '0')}`;

/**
 * Decode one 4096-byte calibration page into rows. Each row's `raw` is the exact stored bytes;
 * `decoded` is set only where the layout and value are known, and never turns invalid BCD into 0.
 */
export function describeDm32CalibrationPage(
  page: Uint8Array,
  address: number,
): Dm32CalibrationRow[] {
  const decode = decodeDm32CalibrationPage(page, address);
  return PAGE_SPECS.map((spec) => {
    const raw = page.slice(spec.offset, spec.offset + spec.length);
    const value = spec.value?.(decode);
    const formatted =
      spec.format && value !== undefined
        ? (spec.format as (v: unknown) => Formatted)(value)
        : undefined;
    return {
      id: spec.id,
      group: spec.group,
      label: spec.label,
      offset: spec.offset,
      length: spec.length,
      raw,
      ...(formatted ? { decoded: formatted.text, reason: formatted.reason, value } : {}),
      layoutConfidence: spec.layout,
      meaningConfidence: spec.meaning,
      source: spec.source,
      ...(spec.note ? { note: spec.note } : {}),
    };
  });
}

const OPTION_SOURCE = '0x0305D908 (boot copy)';

/** Bit-by-bit map of the option bytes, as the firmware copies them to RAM at boot. */
const OPTION_NOTES: Record<number, { meaning: Dm32CalibrationConfidence; note: string }> = {
  0x80: {
    meaning: 'partially-traced',
    note: 'To 0x3FDBC b0, b1, b3 (no known use); b2 = GPS fitted (own row); b5 to 0x3FDBF b0 hides menu rows 1 and 3 (0x03047E8C) and is read by channel load 0x03055DAC and 0x03018270; b6 to 0x3FDBC b4, read by 0x03018270.',
  },
  0x81: {
    meaning: 'partially-traced',
    note: 'b0 to 0x3FDBC b5; b1 to b3 to 0x3FDBF b1 to b3. No known use.',
  },
  0x82: {
    meaning: 'partially-traced',
    note: 'b4 to 0x3FDBC b6, read by the idle screen 0x0303A160. The other bits have no known use.',
  },
  0xa0: {
    meaning: 'traced',
    note: 'Copied to 0x3FDBD. The value 0xA3 forces the English UI (settings loader); any other value leaves the Language setting in charge.',
  },
  0xa2: { meaning: 'unknown', note: 'Copied to 0x3FDC1. No known use.' },
};

/**
 * Factory-sector rows. The anti-clone key at +0x10C is deliberately not a row: it is only in the
 * raw hex view.
 */
export function describeDm32FactorySector(sector: Uint8Array): Dm32CalibrationRow[] {
  const decode: Dm32FactorySectorDecode = decodeDm32FactorySector(sector);
  const rows: Dm32CalibrationRow[] = decode.optionBytes.map(({ offset, value }) => ({
    id: `factory-option-${offset.toString(16)}`,
    group: 'Factory options',
    label: offset === 0xa0 ? 'Option byte (UI language override)' : 'Option byte',
    offset,
    length: 1,
    raw: sector.slice(offset, offset + 1),
    decoded: offset === 0xa0 && value === 0xa3 ? `${hex2(value)}: forces English UI` : hex2(value),
    value,
    layoutConfidence: 'traced',
    meaningConfidence: OPTION_NOTES[offset]!.meaning,
    source: OPTION_SOURCE,
    note: OPTION_NOTES[offset]!.note,
  }));
  rows.push({
    id: 'factory-gps',
    group: 'Factory options',
    label: 'GPS option (+0x80 bit 2)',
    offset: 0x80,
    length: 1,
    raw: sector.slice(0x80, 0x81),
    decoded: decode.gpsEnabled ? 'Set' : 'Clear',
    value: decode.gpsEnabled,
    layoutConfidence: 'traced',
    meaningConfidence: 'traced',
    source: OPTION_SOURCE,
    note: 'UART1 is initialised only when the bit is set.',
  });
  const region = decode.txRegion;
  rows.push({
    id: 'factory-tx-region',
    group: 'Factory options',
    label: 'TX region code',
    offset: 0xa1,
    length: 1,
    raw: sector.slice(0xa1, 0xa2),
    decoded: `${hex2(region)}: ${
      decode.txRegionUnrestricted
        ? '136–174 / 400–470 MHz (4 or 0xA5)'
        : region <= 3
          ? 'restricted window (0–3)'
          : 'other value; the firmware forces values above 4 to 0xA5'
    }`,
    value: { txRegion: region, txRegionUnrestricted: decode.txRegionUnrestricted },
    layoutConfidence: 'traced',
    meaningConfidence: 'traced',
    source: '0x0305D908, TX check 0x0300D7FC',
  });
  return rows;
}

/** What the sidecars claim; only ever a cross-check against the region bytes. */
export interface Dm32SidecarClaims {
  calibration?: { sha256: string | null; liveAddress: number | null };
  factory?: { kept: boolean; reason?: 'mismatch' | 'failed'; sha256?: string };
}

function sidecarJson(bytes: Uint8Array | undefined): Record<string, unknown> | undefined {
  if (!bytes) return undefined;
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

export function readDm32SidecarClaims(sidecars: Record<string, Uint8Array>): Dm32SidecarClaims {
  const claims: Dm32SidecarClaims = {};
  const cal = sidecarJson(sidecars[DM32_CALIBRATION_JSON_PATH]);
  if (cal && (cal.sha256 === null || typeof cal.sha256 === 'string'))
    claims.calibration = {
      sha256: cal.sha256 as string | null,
      liveAddress: typeof cal.liveAddress === 'number' ? cal.liveAddress : null,
    };
  const fac = sidecarJson(sidecars[DM32_FACTORY_JSON_PATH]);
  if (fac && typeof fac.kept === 'boolean')
    claims.factory = {
      kept: fac.kept,
      ...(fac.reason === 'mismatch' || fac.reason === 'failed' ? { reason: fac.reason } : {}),
      ...(typeof fac.sha256 === 'string' ? { sha256: fac.sha256 } : {}),
    };
  return claims;
}

export interface Dm32LiveCalibrationSelection {
  coverage: Dm32DebugCoverage;
  /** The live page (lowest in-window tag 0x02), from region bytes only. */
  address?: number;
  page?: Uint8Array;
  /** Higher in-window tag 0x02 pages: listed, never decoded. */
  duplicates: { address: number; page: Uint8Array }[];
  /** Regions the classifier refused, with its reason; never searched for calibration. */
  refused: Dm32DebugCoverage['unclassified'];
  /** The validated factory sector, when one unambiguous region carries it. */
  factory?: { address: number; bytes: Uint8Array };
}

/** The one live-page lookup, shared by the viewer and Compare. */
export function selectDm32LiveCalibration(
  archive: Dm32CompareArchive,
): Dm32LiveCalibrationSelection {
  const coverage = classifyDm32DebugCoverage(archive.manifest, archive.regions, archive.sidecars);
  const pageAt = (address: number): Uint8Array | undefined => {
    const region = coverage.windowRegions.find(
      (r) =>
        r.id !== DM32_FACTORY_SECTOR_REGION_ID &&
        r.address <= address &&
        address < r.address + r.byteLength,
    );
    if (!region) return undefined;
    const offset = address - region.address;
    return archive.regions[region.id]?.subarray(offset, offset + DM32_BLOCK_SIZE);
  };
  const live = coverage.blocks.find((block) => block.calibration === 'live');
  const page = live && pageAt(live.address);
  const duplicates = coverage.blocks.flatMap((block) => {
    const dup = block.calibration === 'duplicate' ? pageAt(block.address) : undefined;
    return dup ? [{ address: block.address, page: dup }] : [];
  });
  const factoryRegion =
    coverage.factory &&
    !coverage.unclassified.some((entry) => entry.region.id === coverage.factory?.id)
      ? coverage.factory
      : undefined;
  const factoryBytes = factoryRegion && archive.regions[factoryRegion.id];
  return {
    coverage,
    ...(live && page ? { address: live.address, page } : {}),
    duplicates,
    refused: coverage.unclassified,
    ...(factoryRegion && factoryBytes?.length === DM32_FACTORY_SECTOR_LENGTH
      ? { factory: { address: factoryRegion.address, bytes: factoryBytes } }
      : {}),
  };
}
