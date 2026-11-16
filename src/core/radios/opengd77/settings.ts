/**
 * OpenGD77 firmware settings (`settingsStruct_t`, DM-1701 family and MD-9600) and the codeplug
 * device-info / general-settings blocks, decoded read-only from whatever bytes a capture holds.
 *
 * Layout and meanings come from reading two OpenGD77 source snapshots (DM-1701 family 2026-01-30,
 * MD-9600 2026-01-31); never validated on hardware. The struct is at SPI flash 0x604B, little
 * endian, ARM natural alignment, magic/version 0x4780, size 0x74 (DM-1701) / 0x70 (MD-9600).
 * The size assumes 1-byte enums (`roaming`), which is inferred. Reference:
 * docs/reference/radios/baofeng/dm-1701/settings.md and docs/reference/radios/tyt/md-9600/settings.md.
 *
 * Pure: it takes a `read(abs, length)` that returns bytes only when every byte is captured.
 */

export const OPENGD77_SETTINGS_ADDRESS = 0x604b;
export const OPENGD77_SETTINGS_MAGIC = 0x4780;

export type OpenGd77SettingsModel = 'dm-1701' | 'md-9600';

export const OPENGD77_SETTINGS_SIZE: Record<OpenGd77SettingsModel, number> = {
  'dm-1701': 0x74,
  'md-9600': 0x70,
};

/** Meaning confidence: traced from the source, partly (inferred), unknown. */
export type OpenGd77SettingsConfidence = 'traced' | 'partly' | 'unknown';

export type OpenGd77ByteReader = (abs: number, length: number) => Uint8Array | undefined;

export interface OpenGd77SettingsMember {
  id: string;
  name: string;
  /** Offset from the struct start. */
  offset: number;
  length: number;
  type: string;
  state: 'captured' | 'partly-captured' | 'not-captured';
  raw?: Uint8Array;
  /** Decoded value; absent unless the whole member is captured. */
  value?: string;
  meaning: string;
  confidence: OpenGd77SettingsConfidence;
  /** False when nothing in OpenGD77 reads this member. */
  hasReader: boolean;
  evidence: string;
  note?: string;
}

export type OpenGd77SettingsDecode =
  | {
      status: 'ok';
      model: OpenGd77SettingsModel;
      size: number;
      /** Where the live copy is and how fresh this flash copy is. */
      provenance: string;
      members: OpenGd77SettingsMember[];
      /** Struct bytes covered by the capture (struct padding excluded). */
      capturedBytes: number;
      memberBytes: number;
      /** Padding between the last member and the struct size (DM-1701 only). */
      paddingBytes: number;
    }
  | { status: 'not-captured'; reason: string }
  | { status: 'refused'; reason: string };

type Dv = DataView;
interface MemberSpec {
  id: string;
  name: string;
  /** Offset for [dm-1701, md-9600]; `null` when the member does not exist on that model. */
  at: [number | null, number | null];
  length: number | [number, number];
  type: string;
  meaning: string;
  confidence?: OpenGd77SettingsConfidence;
  hasReader?: boolean;
  evidence: string;
  note?: string;
  decode: (dv: Dv, model: OpenGd77SettingsModel) => string;
}

const hex = (n: number, width = 2) => `0x${n.toString(16).toUpperCase().padStart(width, '0')}`;
const num = (dv: Dv) => dv.getUint8(0).toString();
const u8 = (dv: Dv, i = 0) => dv.getUint8(i);
const enumOf =
  (labels: readonly string[]) =>
  (dv: Dv): string => {
    const v = dv.getUint8(0);
    return labels[v] ? `${v} · ${labels[v]}` : `${v} · not a known value`;
  };
const bitNames = (v: number, names: Record<number, string>): string => {
  const set = Object.entries(names)
    .filter(([bit]) => (v >> Number(bit)) & 1)
    .map(([, name]) => name);
  return set.length ? set.join(', ') : 'none set';
};
const mhz10 = (v: number) => (v === 0 ? 'unset (0)' : `${(v / 100000).toFixed(5)} MHz`);

/** Fixed point location: bit 31 sign, bits 30-23 integer degrees, bits 22-0 decimal × 1e-5. */
function location(v: number): string {
  if (v === 0x7f000000) return 'not set (0x7F000000)';
  const sign = v >>> 31 ? '-' : '';
  const deg = (v >>> 23) & 0xff;
  const dec = v & 0x7fffff;
  return `${sign}${deg}.${String(dec).padStart(5, '0')} degrees`;
}

const TX_POWER_LABELS: Record<OpenGd77SettingsModel, readonly string[]> = {
  'dm-1701': ['50 mW', '250 mW', '500 mW', '750 mW', '1 W', '2 W', '3 W', '4 W', '5 W', '+W-'],
  'md-9600': ['100 mW', '250 mW', '500 mW', '750 mW', '1 W', '5 W', '10 W', '25 W', '40 W', '+W-'],
};
const MIC_ZERO: Record<OpenGd77SettingsModel, { dmr: number; fm: number }> = {
  'dm-1701': { dmr: 5, fm: 4 },
  'md-9600': { dmr: 8, fm: 6 },
};
const SWEEP_STEPS = [78, 157, 313, 625, 1250, 2500, 5000];
const APRS_INTERVALS = ['0.2', '0.5', '1', '2', '3', '5', '10', '20', '30', '60'];
const GPS_MODES = ['not detected', 'off', 'on', 'on NMEA', 'on + log'];
const GPS_BAUDS = [9600, 19200, 38400, 57600, 115200, 230400, 460800];
const APRS_MODES = ['off', 'manual', 'PTT', 'auto', 'smart'];

/** Option bits of `bitfieldOptions`; bits marked per model exist on that model only. */
function optionBits(model: OpenGd77SettingsModel): Record<number, string> {
  const bits: Record<number, string> = {
    0: 'inverse video',
    1: 'PTT latch',
    3: 'battery voltage in header',
    4: 'settings updated (user not yet notified)',
    5: 'TX/RX frequency lock',
    6: 'all LEDs disabled',
    7: 'scan on boot',
    9: 'satellite manual/auto',
    12: 'DMR CRC ignored',
    13: 'APO with RF',
    14: 'safe power-on',
    15: 'auto night',
    16: 'night override',
    17: 'daytime',
    19: 'secondary language',
    21: 'display channel distance',
    25: 'TX inhibit',
    26: 'time in header',
    27: 'channels read-only',
    28: 'UI double height',
  };
  if (model === 'md-9600') bits[11] = 'speaker click suppress';
  if (model === 'dm-1701') bits[18] = 'visual volume';
  return bits;
}

const R = (id: string) => id;

const SPECS: MemberSpec[] = [
  {
    id: R('magicNumber'),
    name: 'magicNumber',
    at: [0x00, 0x00],
    length: 4,
    type: 'u32',
    meaning: 'Settings version; must be 0x4780',
    evidence: 'settings.c:44, :124-129',
    decode: (dv) => hex(dv.getUint32(0, true), 4),
  },
  {
    id: 'location.lat',
    name: 'location.lat',
    at: [0x04, 0x04],
    length: 4,
    type: 'u32',
    meaning: 'Latitude: sign bit, 8-bit integer degrees, 23-bit decimal part × 1e-5',
    evidence: 'uiUtilities.c:499-509',
    decode: (dv) => location(dv.getUint32(0, true)),
  },
  {
    id: 'location.lon',
    name: 'location.lon',
    at: [0x08, 0x08],
    length: 4,
    type: 'u32',
    meaning: 'Longitude, same encoding',
    evidence: 'uiUtilities.c:499-509',
    decode: (dv) => location(dv.getUint32(0, true)),
  },
  {
    id: 'timezone',
    name: 'timezone',
    at: [0x0c, 0x0c],
    length: 1,
    type: 'u8',
    meaning: 'Bits 0-6: offset in 15-minute steps, 64 = UTC; bit 7: show local time',
    evidence: 'menuDisplayOptions.c:682-699, :995-1003, :316-319',
    decode: (dv) => {
      const v = dv.getUint8(0);
      const mins = ((v & 0x7f) - 64) * 15;
      const sign = mins < 0 ? '-' : '+';
      const a = Math.abs(mins);
      return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}, ${v & 0x80 ? 'local time shown' : 'UTC shown'}`;
    },
  },
  {
    id: 'beepOptions',
    name: 'beepOptions',
    at: [0x0d, 0x0d],
    length: 1,
    type: 'u8',
    meaning: 'Bits: TX start, TX stop, RX carrier, RX talker, RX talker begin',
    evidence: 'settings.h:82-87',
    decode: (dv) =>
      bitNames(dv.getUint8(0), {
        0: 'TX start',
        1: 'TX stop',
        2: 'RX carrier',
        3: 'RX talker',
        4: 'RX talker begin',
      }),
  },
  {
    id: 'vfoSweepSettings',
    name: 'vfoSweepSettings',
    at: [0x0e, 0x0e],
    length: 2,
    type: 'u16',
    meaning: 'VFO sweep: step index (bits 12-14), RSSI noise floor (7-11), gain (0-6)',
    evidence: 'codeplug.c:83, uiVFOMode.c:1436, :3455',
    note: 'The step unit (10 Hz) is inferred.',
    decode: (dv) => {
      const v = dv.getUint16(0, true);
      const idx = (v >> 12) & 7;
      const step = SWEEP_STEPS[idx];
      return `step ${idx}${step === undefined ? ' (not a known index)' : ` (${step})`}, noise floor ${(v >> 7) & 0x1f}, gain ${v & 0x7f}`;
    },
  },
  {
    id: 'overrideTG',
    name: 'overrideTG',
    at: [0x10, 0x10],
    length: 4,
    type: 'u32',
    meaning: 'Channel-mode talk group / private call override; 0 = none',
    evidence: 'uiChannelMode.c:762-768',
    decode: (dv) => (dv.getUint32(0, true) === 0 ? 'none (0)' : String(dv.getUint32(0, true))),
  },
  {
    id: 'vfoScanLow',
    name: 'vfoScanLow',
    at: [0x14, 0x14],
    length: 8,
    type: 'u32[2]',
    meaning: 'VFO A, VFO B scan low edge, 10 Hz units; 0 = unset',
    evidence: 'uiVFOMode.c:635, :3570',
    decode: (dv) => `A ${mhz10(dv.getUint32(0, true))}; B ${mhz10(dv.getUint32(4, true))}`,
  },
  {
    id: 'vfoScanHigh',
    name: 'vfoScanHigh',
    at: [0x1c, 0x1c],
    length: 8,
    type: 'u32[2]',
    meaning: 'VFO A, VFO B scan high edge, 10 Hz units; 0 = unset',
    evidence: 'uiVFOMode.c:635, :3570',
    decode: (dv) => `A ${mhz10(dv.getUint32(0, true))}; B ${mhz10(dv.getUint32(4, true))}`,
  },
  {
    id: 'bitfieldOptions',
    name: 'bitfieldOptions',
    at: [0x24, 0x24],
    length: 4,
    type: 'u32',
    meaning: 'Option bits (inverse video, PTT latch, scan on boot, and so on)',
    evidence: 'settings.h:128-176',
    decode: (dv, model) => {
      const v = dv.getUint32(0, true);
      const names = optionBits(model);
      const set = [];
      for (let b = 0; b < 32; b++) if ((v >>> b) & 1) set.push(names[b] ?? `bit ${b} (unnamed)`);
      return `${hex(v, 8)}: ${set.length ? set.join(', ') : 'none set'}`;
    },
  },
  {
    id: 'aprsBeaconingSettingsPart1',
    name: 'aprsBeaconingSettingsPart1',
    at: [0x28, 0x28],
    length: 8,
    type: 'u32[2]',
    meaning:
      'APRS beaconing, part 1: mode (word 0 bits 29-31) and smart-beacon rates, speeds and turn parameters',
    evidence: 'aprs.c:1723-1775, aprs.h:100-150',
    decode: (dv) => {
      const w0 = dv.getUint32(0, true);
      const mode = w0 >>> 29;
      return `mode ${APRS_MODES[mode] ?? `${mode} (not a known mode)`}; words ${hex(w0, 8)}, ${hex(dv.getUint32(4, true), 8)}`;
    },
  },
  {
    id: 'gpsLogMemOffset',
    name: 'gpsLogMemOffset',
    at: [0x30, 0x30],
    length: 4,
    type: 'u32',
    meaning: 'Current offset into the NMEA log flash area',
    evidence: 'applicationMain.h:36-46',
    decode: (dv) => String(dv.getUint32(0, true)),
  },
  {
    id: 'currentIndexInTRxGroupList',
    name: 'currentIndexInTRxGroupList',
    at: [0x34, 0x34],
    length: 6,
    type: 'i16[3]',
    meaning: 'Index in the RX group list for channel mode, VFO A, VFO B',
    evidence: 'settings.h:37',
    decode: (dv) =>
      `channel ${dv.getInt16(0, true)}; VFO A ${dv.getInt16(2, true)}; VFO B ${dv.getInt16(4, true)}`,
  },
  {
    id: 'currentZone',
    name: 'currentZone',
    at: [0x3a, 0x3a],
    length: 2,
    type: 'i16',
    meaning: 'Current zone index',
    evidence: 'settings.h',
    decode: (dv) => String(dv.getInt16(0, true)),
  },
  {
    id: 'userPower',
    name: 'userPower',
    at: [0x3c, 0x3c],
    length: 2,
    type: 'u16',
    meaning: 'The "+W-" power: raw PA DAC code (0-4095)',
    evidence: 'DM-1701 trx.c:868, MD-9600 trx.c:858',
    decode: (dv) => `${dv.getUint16(0, true)} (DAC code)`,
  },
  {
    id: 'tsManualOverride',
    name: 'tsManualOverride',
    at: [0x3e, 0x3e],
    length: 2,
    type: 'u16',
    meaning:
      '2 bits per channel kind (VFO A bits 0-1, VFO B 2-3, channel 4-5): 0 none, 1 TS1, 2 TS2; bits 6-8 contact-override-applied flags',
    evidence: 'uiUtilities.c:98-190, codeplug.h:184-186',
    decode: (dv) => {
      const v = dv.getUint16(0, true);
      const ts = (shift: number) => ['none', 'TS1', 'TS2'][(v >> shift) & 3] ?? 'not a known value';
      return `VFO A ${ts(0)}; VFO B ${ts(2)}; channel ${ts(4)}; flags ${(v >> 6) & 7}`;
    },
  },
  {
    id: 'unused1',
    name: 'UNUSED_1 / currentChannelIndexInZone',
    at: [0x40, 0x40],
    length: 2,
    type: 'i16',
    meaning: 'DM-1701: unused. MD-9600: last channel index in the current zone',
    evidence: 'settings.h:184-267',
    decode: (dv) => String(dv.getInt16(0, true)),
  },
  {
    id: 'unused2',
    name: 'UNUSED_2 / currentChannelIndexInAllZone',
    at: [0x42, 0x42],
    length: 2,
    type: 'i16',
    meaning: 'DM-1701: unused. MD-9600: last index in the all-channels zone',
    evidence: 'settings.h:184-267',
    decode: (dv) => String(dv.getInt16(0, true)),
  },
  {
    id: 'aprsBeaconingSettingsPart2',
    name: 'aprsBeaconingSettingsPart2',
    at: [0x44, 0x44],
    length: 2,
    type: 'u16',
    meaning:
      'APRS beaconing, part 2: power level (bits 12-15), state bits (4-11), initial interval index (0-3)',
    evidence: 'aprs.h:96-150',
    decode: (dv) => {
      const v = dv.getUint16(0, true);
      const idx = v & 0xf;
      const iv = APRS_INTERVALS[idx];
      return `power level ${v >> 12}; state bits ${hex((v >> 4) & 0xff)}; initial interval ${iv === undefined ? `index ${idx} (not known)` : `${iv} min`}`;
    },
  },
  {
    id: 'txPowerLevel',
    name: 'txPowerLevel',
    at: [0x46, 0x46],
    length: 1,
    type: 'u8',
    meaning: 'TX power level 0-9; labels differ per model',
    evidence: 'uiGlobals.c:36-48',
    decode: (dv, model) => {
      const v = dv.getUint8(0);
      const label = TX_POWER_LABELS[model][v];
      return label ? `${v} · ${label}` : `${v} · not a known level`;
    },
  },
  {
    id: 'txTimeoutBeepX5Secs',
    name: 'txTimeoutBeepX5Secs',
    at: [0x47, 0x47],
    length: 1,
    type: 'u8',
    meaning: 'TX timeout warning beep, in 5 s units (0-4)',
    evidence: 'settings.h',
    decode: (dv) => `${dv.getUint8(0)} (${dv.getUint8(0) * 5} s)`,
  },
  {
    id: 'beepVolumeDivider',
    name: 'beepVolumeDivider',
    at: [0x48, 0x48],
    length: 1,
    type: 'u8',
    meaning: 'Beep volume divider 0-10; shown as (2 - v) × 3 dB',
    evidence: 'menuSoundOptions.c',
    decode: (dv) => `${dv.getUint8(0)} (${(2 - dv.getUint8(0)) * 3} dB)`,
  },
  {
    id: 'micGainDMR',
    name: 'micGainDMR',
    at: [0x49, 0x49],
    length: 1,
    type: 'u8',
    meaning: 'DMR mic gain, shown as (v - zero) × 3 dB; zero is 5 (DM-1701) or 8 (MD-9600)',
    evidence: 'settings.h:89-98',
    decode: (dv, model) => `${dv.getUint8(0)} (${(dv.getUint8(0) - MIC_ZERO[model].dmr) * 3} dB)`,
  },
  {
    id: 'micGainFM',
    name: 'micGainFM',
    at: [0x4a, 0x4a],
    length: 1,
    type: 'u8',
    meaning: 'FM mic gain, shown as (v - zero) × 3 dB; zero is 4 (DM-1701) or 6 (MD-9600)',
    evidence: 'settings.h:89-98',
    decode: (dv, model) => `${dv.getUint8(0)} (${(dv.getUint8(0) - MIC_ZERO[model].fm) * 3} dB)`,
  },
  {
    id: 'backlightMode',
    name: 'backlightMode',
    at: [0x4b, 0x4b],
    length: 1,
    type: 'u8',
    meaning: 'Backlight mode',
    evidence: 'settings.h:38',
    decode: enumOf(['auto', 'squelch', 'manual', 'buttons', 'none']),
  },
  {
    id: 'backLightTimeout',
    name: 'backLightTimeout',
    at: [0x4c, 0x4c],
    length: 1,
    type: 'u8',
    meaning: 'Backlight timeout in seconds; 0 = never',
    evidence: 'settings.h',
    decode: (dv) => (dv.getUint8(0) === 0 ? 'never (0)' : `${dv.getUint8(0)} s`),
  },
  {
    id: 'displayContrast',
    name: 'displayContrast',
    at: [0x4d, 0x4d],
    length: 1,
    type: 'i8',
    meaning: 'Display contrast; range depends on the display type',
    evidence: 'menuDisplayOptions.c:54-58',
    decode: (dv) => String(dv.getInt8(0)),
  },
  {
    id: 'displayBacklightPercentage',
    name: 'displayBacklightPercentage',
    at: [0x4e, 0x4e],
    length: 2,
    type: 'i8[2]',
    meaning: 'Backlight brightness %, day and night',
    evidence: 'applicationMain.h:48-53',
    decode: (dv) => `day ${dv.getInt8(0)} %; night ${dv.getInt8(1)} %`,
  },
  {
    id: 'displayBacklightPercentageOff',
    name: 'displayBacklightPercentageOff',
    at: [0x50, 0x50],
    length: 1,
    type: 'i8',
    meaning: 'Brightness % when the backlight is "off"',
    evidence: 'settings.h',
    decode: (dv) => `${dv.getInt8(0)} %`,
  },
  {
    id: 'initialMenuNumber',
    name: 'initialMenuNumber',
    at: [0x51, 0x51],
    length: 1,
    type: 'u8',
    meaning: 'Screen to start in: VFO or channel mode (menu enum value)',
    confidence: 'partly',
    evidence: 'menuSystem.h:290-332',
    note: 'The values (DM-1701 VFO 33 / channel 34; MD-9600 VFO 32 / channel 33) were inferred by counting the enum.',
    decode: (dv, model) => {
      const v = dv.getUint8(0);
      const [vfo, ch] = model === 'dm-1701' ? [33, 34] : [32, 33];
      return v === vfo
        ? `${v} · VFO mode`
        : v === ch
          ? `${v} · channel mode`
          : `${v} · other screen`;
    },
  },
  {
    id: 'extendedInfosOnScreen',
    name: 'extendedInfosOnScreen',
    at: [0x52, 0x52],
    length: 1,
    type: 'u8',
    meaning: 'Extra info on the main screen',
    evidence: 'settings.h:45',
    decode: enumOf(['off', 'timeslot', 'power', 'both']),
  },
  {
    id: 'txFreqLimited',
    name: 'txFreqLimited',
    at: [0x53, 0x53],
    length: 1,
    type: 'u8',
    meaning: 'TX frequency limiting',
    evidence: 'settings.h:44',
    decode: enumOf(['none', 'legacy default (US ham bands)', 'from CPS']),
  },
  {
    id: 'scanModePause',
    name: 'scanModePause',
    at: [0x54, 0x54],
    length: 1,
    type: 'u8',
    meaning: 'What scan does on a hit',
    evidence: 'settings.h',
    decode: enumOf(['hold', 'pause', 'stop']),
  },
  {
    id: 'scanDelay',
    name: 'scanDelay',
    at: [0x55, 0x55],
    length: 1,
    type: 'u8',
    meaning: 'Scan delay in seconds',
    evidence: 'settings.h',
    decode: (dv) => `${dv.getUint8(0)} s`,
  },
  {
    id: 'dmrRxAGC',
    name: 'dmrRxAGC',
    at: [0x56, 0x56],
    length: 1,
    type: 'u8',
    meaning: 'DMR RX AGC; 0 off, otherwise (v - 1) × 3 dB',
    evidence: 'menuSoundOptions.c:42-50, :269',
    decode: (dv) => {
      const v = dv.getUint8(0);
      return v === 0 ? 'off (0)' : `${v} (${(v - 1) * 3} dB)`;
    },
  },
  {
    id: 'hotspotType',
    name: 'hotspotType',
    at: [0x57, 0x57],
    length: 1,
    type: 'u8',
    meaning: 'Hotspot type',
    evidence: 'settings.h',
    decode: enumOf(['off', 'MMDVM', 'BlueDV']),
  },
  {
    id: 'scanStepTime',
    name: 'scanStepTime',
    at: [0x58, 0x58],
    length: 1,
    type: 'u8',
    meaning: 'Scan step time = 30 ms + v × 30 ms, v 0-15',
    evidence: 'settings.c:639-642',
    decode: (dv) => `${dv.getUint8(0)} (${30 + dv.getUint8(0) * 30} ms)`,
  },
  {
    id: 'currentVFONumber',
    name: 'currentVFONumber',
    at: [0x59, 0x59],
    length: 1,
    type: 'u8',
    meaning: 'Current VFO',
    evidence: 'settings.h',
    decode: enumOf(['VFO A', 'VFO B']),
  },
  {
    id: 'dmrDestinationFilter',
    name: 'dmrDestinationFilter',
    at: [0x5a, 0x5a],
    length: 1,
    type: 'u8',
    meaning: 'DMR destination filter',
    evidence: 'settings.h',
    decode: enumOf(['none', 'talk group', 'DMR ID', 'RX group']),
  },
  {
    id: 'dmrCaptureTimeout',
    name: 'dmrCaptureTimeout',
    at: [0x5b, 0x5b],
    length: 1,
    type: 'u8',
    meaning: 'Seconds the radio stays on a call after it ends',
    evidence: 'settings.h',
    decode: (dv) => `${dv.getUint8(0)} s`,
  },
  {
    id: 'dmrCcTsFilter',
    name: 'dmrCcTsFilter',
    at: [0x5c, 0x5c],
    length: 1,
    type: 'u8',
    meaning: 'Bit 0 colour code filter, bit 1 timeslot filter',
    evidence: 'settings.h',
    decode: (dv) => bitNames(dv.getUint8(0), { 0: 'CC filter', 1: 'TS filter' }),
  },
  {
    id: 'analogFilterLevel',
    name: 'analogFilterLevel',
    at: [0x5d, 0x5d],
    length: 1,
    type: 'u8',
    meaning: 'Analogue filter level',
    evidence: 'settings.h',
    decode: enumOf(['none', 'CSS']),
  },
  {
    id: 'privateCalls',
    name: 'privateCalls',
    at: [0x5e, 0x5e],
    length: 1,
    type: 'u8',
    meaning: 'Private calls',
    evidence: 'settings.h',
    decode: enumOf(['off', 'on', 'PTT']),
  },
  {
    id: 'contactDisplayPriority',
    name: 'contactDisplayPriority',
    at: [0x5f, 0x5f],
    length: 1,
    type: 'u8',
    meaning: 'Contact display priority',
    evidence: 'settings.h',
    decode: enumOf(['CC-DB-TA', 'DB-CC-TA', 'TA-CC-DB', 'TA-DB-CC']),
  },
  {
    id: 'splitContact',
    name: 'splitContact',
    at: [0x60, 0x60],
    length: 1,
    type: 'u8',
    meaning: 'Contact display lines',
    evidence: 'settings.h',
    decode: enumOf(['single line', 'two lines', 'auto']),
  },
  {
    id: 'voxThreshold',
    name: 'voxThreshold',
    at: [0x61, 0x61],
    length: 1,
    type: 'u8',
    meaning: 'VOX threshold; 0 = VOX off',
    evidence: 'settings.h',
    decode: (dv) => (dv.getUint8(0) === 0 ? 'off (0)' : String(dv.getUint8(0))),
  },
  {
    id: 'voxTailUnits',
    name: 'voxTailUnits',
    at: [0x62, 0x62],
    length: 1,
    type: 'u8',
    meaning: 'VOX tail = (v - 1) × 0.5 s for v > 1, else 0',
    evidence: 'menuSoundOptions.c:55',
    decode: (dv) => {
      const v = dv.getUint8(0);
      return `${v} (${v > 1 ? (v - 1) * 0.5 : 0} s)`;
    },
  },
  {
    id: 'audioPromptMode',
    name: 'audioPromptMode',
    at: [0x63, 0x63],
    length: 1,
    type: 'u8',
    meaning: 'Audio prompts',
    evidence: 'settings.h',
    decode: enumOf([
      'silent',
      'beep',
      'no key beep',
      'voice level 1',
      'voice level 2',
      'voice level 3',
    ]),
  },
  {
    id: 'temperatureCalibration',
    name: 'temperatureCalibration',
    at: [0x64, 0x64],
    length: 1,
    type: 'i8',
    meaning: 'Temperature calibration in 0.5 °C steps, -20..20',
    evidence: 'adc.c:120',
    decode: (dv) => `${dv.getInt8(0)} (${dv.getInt8(0) * 0.5} °C)`,
  },
  {
    id: 'batteryCalibration',
    name: 'batteryCalibration',
    at: [0x65, 0x65],
    length: 1,
    type: 'u8',
    meaning:
      'Low 4 bits: voltage offset = v - 5 added to the battery reading (0.1 V units); high 4 bits unused',
    evidence: 'adc.c:85',
    decode: (dv) => `${hex(dv.getUint8(0))} (offset ${(dv.getUint8(0) & 0xf) - 5} × 0.1 V)`,
  },
  {
    id: 'squelchDefaults',
    name: 'squelchDefaults',
    at: [0x66, 0x66],
    length: [3, 2],
    type: 'u8[3] / u8[2]',
    meaning:
      'Default squelch per band (DM-1701: VHF, 220 MHz, UHF; MD-9600: VHF, UHF): 1-21 = 0-100 % in 5 % steps',
    evidence: 'menuRadioOptions.c:193-203',
    decode: (dv) =>
      Array.from({ length: dv.byteLength }, (_, i) => `${(dv.getUint8(i) - 1) * 5} %`).join(', '),
  },
  {
    id: 'ecoLevel',
    name: 'ecoLevel',
    at: [0x69, 0x68],
    length: 1,
    type: 'u8',
    meaning: 'Power saving level 0-5',
    evidence: 'settings.h',
    decode: num,
  },
  {
    id: 'apo',
    name: 'apo',
    at: [0x6a, 0x69],
    length: 1,
    type: 'u8',
    meaning: 'Auto power-off in 30 minute units; 0 = off',
    evidence: 'applicationMain.c:531',
    decode: (dv) => (u8(dv) === 0 ? 'off (0)' : `${u8(dv) * 30} min`),
  },
  {
    id: 'keypadTimerLong',
    name: 'keypadTimerLong',
    at: [0x6b, 0x6a],
    length: 1,
    type: 'u8',
    meaning: 'Keypad long-press time in 0.1 s units (1-90)',
    evidence: 'keyboard.c:456',
    decode: (dv) => `${u8(dv)} (${u8(dv) / 10} s)`,
  },
  {
    id: 'keypadTimerRepeat',
    name: 'keypadTimerRepeat',
    at: [0x6c, 0x6b],
    length: 1,
    type: 'u8',
    meaning: 'Keypad repeat time in 0.1 s units (1-90)',
    evidence: 'keyboard.c:456',
    decode: (dv) => `${u8(dv)} (${u8(dv) / 10} s)`,
  },
  {
    id: 'autolockTimer',
    name: 'autolockTimer',
    at: [0x6d, 0x6c],
    length: 1,
    type: 'u8',
    meaning: 'Auto keypad lock in minutes; 0 = off',
    evidence: 'settings.h',
    decode: (dv) => (u8(dv) === 0 ? 'off (0)' : `${u8(dv)} min`),
  },
  {
    id: 'roaming',
    name: 'roaming',
    at: [0x6e, 0x6d],
    length: 1,
    type: 'enum (1 byte, inferred)',
    meaning: 'Roaming mode',
    confidence: 'partly',
    evidence: 'settings.h:66-74',
    note: 'The enum size is inferred (arm-none-eabi short enums); 4-byte enums would make both structs 0x78 and move this and the last two members.',
    decode: enumOf(['off', 'manual', '5 km', '10 km', '20 km']),
  },
  {
    id: 'gpsModeAndBaudsIndex',
    name: 'gpsModeAndBaudsIndex',
    at: [0x6f, 0x6e],
    length: 1,
    type: 'u8',
    meaning: 'Low nibble GPS mode; high nibble baud index + 1 (0 = undetected)',
    evidence: 'settings.h:47-64, gps.c:757',
    decode: (dv) => {
      const v = dv.getUint8(0);
      const mode = GPS_MODES[v & 0xf] ?? `${v & 0xf} (not a known mode)`;
      const b = v >> 4;
      return `${mode}; baud ${b === 0 ? 'undetected' : (GPS_BAUDS[b - 1] ?? `index ${b - 1} (not known)`)}`;
    },
  },
  {
    id: 'lastTalkerOnScreenTimer',
    name: 'lastTalkerOnScreenTimer',
    at: [0x70, 0x6f],
    length: 1,
    type: 'u8',
    meaning: 'Last talker on-screen time in seconds, 0-30',
    evidence: 'settings.h',
    decode: (dv) => `${u8(dv)} s`,
  },
];

/** Members that nothing in the source reads (DM-1701 UNUSED_1/2). */
const NO_READER_ON: Record<string, OpenGd77SettingsModel> = {
  unused1: 'dm-1701',
  unused2: 'dm-1701',
};

export const OPENGD77_SETTINGS_MEMBER_COUNT = SPECS.length;

export function openGd77SettingsProvenance(model: OpenGd77SettingsModel): string {
  return model === 'dm-1701'
    ? 'Flash copy as of the last power-off or CPS save; menu changes stay in RAM until then.'
    : 'Backup copy; the live copy is in backup SRAM.';
}

/**
 * Decode the firmware settings struct from the captured bytes. Checks the magic and the model
 * (the caller passes the model its identity check resolved). Members that are not fully in the
 * capture show as not captured.
 */
export function decodeOpenGd77Settings(
  model: OpenGd77SettingsModel,
  read: OpenGd77ByteReader,
): OpenGd77SettingsDecode {
  const magicBytes = read(OPENGD77_SETTINGS_ADDRESS, 4);
  if (!magicBytes) {
    return {
      status: 'not-captured',
      reason:
        'The capture does not hold the settings version bytes at 0x604B, so the settings cannot be checked or decoded.',
    };
  }
  const magic = new DataView(magicBytes.buffer, magicBytes.byteOffset, 4).getUint32(0, true);
  if (magic !== OPENGD77_SETTINGS_MAGIC) {
    return {
      status: 'refused',
      reason: `The settings version at 0x604B is ${hex(magic, 4)}, not ${hex(OPENGD77_SETTINGS_MAGIC, 4)}, so no field is named for this firmware.`,
    };
  }
  const index = model === 'dm-1701' ? 0 : 1;
  const members: OpenGd77SettingsMember[] = [];
  let capturedBytes = 0;
  let memberBytes = 0;
  for (const spec of SPECS) {
    const offset = spec.at[index];
    if (offset === null || offset === undefined) continue;
    const length = typeof spec.length === 'number' ? spec.length : spec.length[index]!;
    const abs = OPENGD77_SETTINGS_ADDRESS + offset;
    const whole = read(abs, length);
    let captured = whole ? length : 0;
    if (!whole) {
      for (let i = 0; i < length; i++) if (read(abs + i, 1)) captured++;
    }
    capturedBytes += captured;
    memberBytes += length;
    const partial = !whole && captured > 0;
    const raw = whole
      ? whole
      : partial
        ? Uint8Array.from(
            Array.from({ length }, (_, i) => read(abs + i, 1)?.[0]).filter(
              (b): b is number => b !== undefined,
            ),
          )
        : undefined;
    members.push({
      id: spec.id,
      name: spec.name,
      offset,
      length,
      type: spec.type,
      state: whole ? 'captured' : partial ? 'partly-captured' : 'not-captured',
      ...(raw ? { raw } : {}),
      ...(whole
        ? { value: spec.decode(new DataView(whole.buffer, whole.byteOffset, length), model) }
        : {}),
      meaning: spec.meaning,
      confidence: spec.confidence ?? 'traced',
      hasReader: NO_READER_ON[spec.id] !== model,
      evidence: spec.evidence,
      ...(spec.note ? { note: spec.note } : {}),
    });
  }
  const size = OPENGD77_SETTINGS_SIZE[model];
  return {
    status: 'ok',
    model,
    size,
    provenance: openGd77SettingsProvenance(model),
    members,
    capturedBytes,
    memberBytes,
    paddingBytes: size - memberBytes,
  };
}

// --- Codeplug device info (0x80) and general settings (0xE0) -----------------------------------

export const OPENGD77_DEVICE_INFO_ADDRESS = 0x80;
export const OPENGD77_GENERAL_SETTINGS_ADDRESS = 0xe0;

export interface OpenGd77CodeplugGeneralRow {
  id: string;
  group: 'Device info (0x80)' | 'General settings (0xE0)';
  name: string;
  abs: number;
  length: number;
  captured: boolean;
  raw?: Uint8Array;
  value?: string;
  /** Whether OpenGD77 reads this field. */
  hasReader: boolean;
  meaning: string;
  confidence: OpenGd77SettingsConfidence;
  evidence: string;
}

const NOT_READ = 'not used by OpenGD77 (stock CPS field)';

interface GeneralSpec {
  id: string;
  group: OpenGd77CodeplugGeneralRow['group'];
  name: string;
  abs: number;
  length: number;
  hasReader: boolean;
  meaning: string;
  evidence: string;
  decode?: (raw: Uint8Array) => string;
}

function bcdMhzFromU16(raw: Uint8Array): string {
  const v = raw[0]! | (raw[1]! << 8);
  const text = v.toString(16).padStart(4, '0');
  return /^[0-9]+$/.test(text) ? `${Number(text)} MHz` : `${hex(v, 4)} (not BCD)`;
}

const asText = (raw: Uint8Array) => {
  const text = Array.from(raw)
    .filter((b) => b !== 0 && b !== 0xff)
    .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '?'))
    .join('');
  return text === '' ? '(empty)' : text;
};

function dmrIdFromBcd(raw: Uint8Array): string {
  const digits = Array.from(raw, (b) => `${b >> 4}${b & 15}`).join('');
  if (!/^[0-9]+$/.test(digits) || Array.from(raw).some((b) => b >> 4 > 9 || (b & 15) > 9)) {
    return `invalid BCD (${Array.from(raw, (b) => b.toString(16).padStart(2, '0')).join(' ')})`;
  }
  return String(Number(digits));
}

const unread = (
  id: string,
  group: OpenGd77CodeplugGeneralRow['group'],
  name: string,
  abs: number,
  length: number,
  evidence: string,
): GeneralSpec => ({ id, group, name, abs, length, hasReader: false, meaning: NOT_READ, evidence });

const DEVICE = 'Device info (0x80)' as const;
const GENERAL = 'General settings (0xE0)' as const;
const BAND = (id: string, name: string, abs: number): GeneralSpec => ({
  id,
  group: DEVICE,
  name,
  abs,
  length: 2,
  hasReader: true,
  meaning:
    'User band limit, BCD in MHz; used only if all four limits pass sanity checks against the hardware bands',
  evidence: 'codeplug.c:190-201, settings.c:150-178',
  decode: bcdMhzFromU16,
});

const GENERAL_SPECS: GeneralSpec[] = [
  BAND('minUHFFreq', 'minUHFFreq', 0x80),
  BAND('maxUHFFreq', 'maxUHFFreq', 0x82),
  BAND('minVHFFreq', 'minVHFFreq', 0x84),
  BAND('maxVHFFreq', 'maxVHFFreq', 0x86),
  unread('lastPrgTime', DEVICE, 'lastPrgTime', 0x88, 6, 'codeplug.c:1505-1519'),
  unread('reserve2', DEVICE, 'reserve2', 0x8e, 2, 'codeplug.c:1505-1519'),
  unread('model', DEVICE, 'model', 0x90, 8, 'codeplug.c:1505-1519'),
  unread('sn', DEVICE, 'sn', 0x98, 16, 'codeplug.c:1505-1519'),
  unread('cpsSwVer', DEVICE, 'cpsSwVer', 0xa8, 8, 'codeplug.c:1505-1519'),
  unread('hardwareVer', DEVICE, 'hardwareVer', 0xb0, 8, 'codeplug.c:1505-1519'),
  unread('firmwareVer', DEVICE, 'firmwareVer', 0xb8, 8, 'codeplug.c:1505-1519'),
  unread('dspFwVer', DEVICE, 'dspFwVer', 0xc0, 24, 'codeplug.c:1505-1519'),
  unread('reserve3', DEVICE, 'reserve3', 0xd8, 8, 'codeplug.c:1505-1519'),
  {
    id: 'radioName',
    group: GENERAL,
    name: 'radioName (callsign)',
    abs: 0xe0,
    length: 8,
    hasReader: true,
    meaning: 'Callsign text, padded with 0xFF or 0',
    evidence: 'codeplug.c:1297-1302',
    decode: asText,
  },
  {
    id: 'radioId',
    group: GENERAL,
    name: 'radioId (DMR ID)',
    abs: 0xe8,
    length: 4,
    hasReader: true,
    meaning: 'DMR ID as BCD, big-endian byte order',
    evidence: 'codeplug.c:1283-1294',
    decode: dmrIdFromBcd,
  },
  unread(
    'libreDMRCodeplugVersion',
    GENERAL,
    'libreDMRCodeplugVersion',
    0xec,
    1,
    'codeplug.h:272-294',
  ),
  unread('reserve', GENERAL, 'reserve', 0xed, 3, 'codeplug.h:272-294'),
  unread(
    'stockOptions',
    GENERAL,
    'stock CPS fields (arsInitDly .. flag4)',
    0xf0,
    14,
    'codeplug.h:272-294',
  ),
  unread('reserver2', GENERAL, 'reserver2', 0xfe, 2, 'codeplug.h:272-294'),
  unread('prgPwd', GENERAL, 'prgPwd', 0x100, 8, 'codeplug.h:272-294'),
];

/** Decode the codeplug device info and general settings blocks from whatever is captured. */
export function decodeOpenGd77CodeplugGeneral(
  read: OpenGd77ByteReader,
): OpenGd77CodeplugGeneralRow[] {
  return GENERAL_SPECS.map((spec): OpenGd77CodeplugGeneralRow => {
    const raw = read(spec.abs, spec.length);
    return {
      id: spec.id,
      group: spec.group,
      name: spec.name,
      abs: spec.abs,
      length: spec.length,
      captured: raw !== undefined,
      ...(raw ? { raw } : {}),
      ...(raw && spec.decode ? { value: spec.decode(raw) } : {}),
      hasReader: spec.hasReader,
      meaning: spec.meaning,
      confidence: 'traced',
      evidence: spec.evidence,
    };
  });
}
