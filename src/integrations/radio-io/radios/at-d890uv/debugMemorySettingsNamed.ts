/**
 * AT-D890UV optional-settings bytes that no registered settings field claims, named from the V1.05
 * static trace (radio repo PR #245, F212-F222, F280-F286, F349-F356) and the radio repo's CPS
 * optional-settings reference. Display only: this list never feeds Write, the allow-list or
 * `settingsFields` validation. Offsets are from the start of the main record (`0x03500000`).
 *
 * Kinds: `meaning` the firmware uses the byte; `never-read` it is loaded or saved but no code reads
 * it; `unreferenced` no code refers to the address; `no-reader` bits that no reader uses.
 * Confidence: `traced` (code address or radio docs) or `partly` (traced use, inferred meaning).
 */

export type AtD890NamedSettingKind = 'meaning' | 'never-read' | 'unreferenced' | 'no-reader';
export type AtD890NamedSettingConfidence = 'traced' | 'partly';

export interface AtD890NamedSettingRange {
  /** Offset from `0x03500000`. */
  offset: number;
  length: number;
  name: string;
  meaning: string;
  kind: AtD890NamedSettingKind;
  confidence: AtD890NamedSettingConfidence;
  /** Function address or document section. */
  evidence: string;
  /** Bits of a single byte this row names; the other bits belong to a registered field. */
  mask?: number;
}

type Row = [
  offset: number,
  length: number,
  name: string,
  meaning: string,
  evidence: string,
  kind?: AtD890NamedSettingKind,
  confidence?: AtD890NamedSettingConfidence,
];

const NR = 'never-read' as const;
const NEVER = 'Never read';
const S46 = 'radio docs §4.6';
const S47 = 'radio docs §4.7';

const ROWS: readonly Row[] = [
  [0x02, 1, 'KeyLock', 'Keypad auto-lock: 0 manual, 1 auto', 'docs §4.6'],
  [0x08, 1, 'Step', 'VFO step 0–9 = 2.5, 5, 6.25, 8.33, 10, 12.5, 20, 25, 30, 50 kHz', S46],
  [
    0x09,
    2,
    'SQL1 / SQL2',
    'Analogue squelch A / B: 0 off, 1–5; follow the main side; runtime',
    '0x0806C180',
  ],
  [0x0c, 1, 'VOX', 'VOX on (a level above 1 reads as 1); runtime', S46],
  [0x0d, 1, 'VOX_Delay', 'VOX delay (n + 5) / 10 s, n 0–25', '0x0807896C'],
  [0x0e, 1, 'ScanType', 'Scan resume: 0 TO, 1 CO, 2 SE', 'docs §4.2'],
  [0x15, 2, 'RMV1 / RMV2', 'Side A / B in VFO mode; runtime', 'docs §4.8'],
  [0x17, 1, 'STE_Type', 'CTCSS tail: 0 off, 1 silent, 2 120°, 3 180°, 4 240°, 5 55 Hz', S46],
  [0x18, 1, 'STE_Freq', 'No-signal tail: 0 off, 1 55.2 Hz, 2 259.2 Hz', S46],
  [
    0x1d,
    6,
    'Work_FMCH … Record_En',
    'FM channel, FM VFO/MEM, zone A/B, AM/FM function (0 off, 1 FM, 2/3 AM air A/B), record; mostly runtime',
    'docs §4.6, §4.8',
  ],
  [0x23, 1, 'DTMF speed', 'DTMF speed 0–4 = 50, 100, 200, 300, 500 ms', 'F213'],
  [0x24, 1, 'FailAlarm', 'Man down', '0x08037314'],
  [0x25, 1, 'MonType', NEVER, S47, NR],
  [0x28, 1, 'Gps', 'GPS on; runtime', S46],
  [0x2a, 1, 'FreqDis', NEVER, S47, NR],
  [
    0x2b,
    4,
    'FmMon, MainState, SubMode, TBST',
    'FM monitor; main side (runtime); sub channel shown; tone burst 1000 / 1450 / 1750 / 2100 Hz',
    S46,
  ],
  [0x33, 1, 'VoxHeadset', 'VOX mic: 0 built-in, 1 external, 2 both', '0x08133618'],
  [0x35, 1, 'Voice_Note', NEVER, S47, NR],
  [0x3a, 1, 'TalkOverPoint', NEVER, S47, NR],
  [0x3d, 1, '(unnamed)', NEVER, S47, NR],
  [0x40, 1, 'ContactOutSetEn', NEVER, S47, NR],
  [
    0x49,
    4,
    'DigiMoni, Cc, Id, slot hold',
    'Digital monitor 0/1/2; colour code any/same; ID any/same; slot hold',
    S46,
  ],
  [0x4e, 1, '(keypad locked)', 'Keypad locked by a long *; runtime', 'F106'],
  [0x4f, 1, 'ManDownWait', 'Man-down delay n + 1 s', '0x08037314'],
  [
    0x53,
    1,
    'GpsTextUsed',
    'Append the GPS template text (0x03501280) to the position message',
    '0x0805CBF0',
  ],
  [0x54, 3, '(unnamed)', NEVER, S47, NR],
  [
    0x58,
    16,
    'VfoScanFreq0..3',
    'VFO scan UHF lo/hi, VHF lo/hi; u32 LE, 10 Hz units; not clamped',
    'F281',
  ],
  [0x68, 2, 'UhfAutoRep / VhfAutoRep', 'Auto-repeater 1 offset index (idx1)', '0x080DBA58'],
  [0x6a, 5, '(unnamed), CurTalkPathHold', NEVER, S47, NR],
  [0x6f, 2, 'PriZoneA / B', 'Priority zones; runtime', 'docs §4.8'],
  [0x71, 1, 'MsgOacsuSet', NEVER, S47, NR],
  [
    0x72,
    60,
    'Alert-tone rows 1–3',
    '0x14 bytes each: 5 × u16 LE Hz, then 5 × u16 LE time ÷ 10',
    '0x0801CAA0',
  ],
  [0xae, 1, 'RecordDelay', 'Recording delay, at most 0x19', '0x08118E80'],
  [0xb0, 1, '(unnamed)', NEVER, S47, NR],
  [0xb1, 1, 'BlueToothOn', 'Bluetooth 0 off, 1 on, 2 KISS TNC, 3 test (radio menu only)', S47],
  [0xb2, 1, 'MicInBlueTooth', NEVER, S47, NR],
  [0xb3, 1, 'SpkInBlueTooth', 'Bluetooth plus the internal speaker', S47],
  [0xb4, 1, 'WtRecordNote', NEVER, S47, NR],
  [
    0xb5,
    3,
    'MeasurePeriod, BhtMicGain, BhtSpkGain',
    'Ranging interval at least 5 s; Bluetooth gains 0–4 (above 4 reads as 2)',
    'docs §4.3',
  ],
  [0xba, 1, 'WanderPerod', 'Auto-roaming period n + 1 min', 'N4'],
  [0xbb, 1, 'Ext_Opt2', NEVER, S47, NR],
  [0xbd, 1, '(packed)', 'Distance unit: 0 metric, 1 imperial', '0x08041600'],
  [
    0xbe,
    1,
    '(packed lock)',
    'Lock bits: bit 0 knob, bit 1 keypad incl. P1/P2 (functions 9, 12, 18, 54 exempt), bit 3 PF1–PF3, bit 4 forced lock (lock active without a long *; also blocks a short Menu); bit 2 unused. Default 0x0F; 0xFF reads as 0',
    '0x08016978, 0x08020860, 0x08020968',
  ],
  [0xbf, 1, 'WanderEffectWait', 'Roaming effect wait n s', 'N3'],
  [
    0xc2,
    1,
    '(packed)',
    'Non-zero, DMR only: an "LH: …" line from 0x20007DBA on the call screen. Meaning inferred',
    'decompile ~57398',
    'meaning',
    'partly',
  ],
  [
    0xc4,
    16,
    'AutoRepFreq0..3',
    'Auto-repeater 1 limits, 4 × u32 LE 10 Hz, clamped to the band at load',
    'F281',
  ],
  [0xd5, 1, 'BookOwnId', 'Address book sent with own ID', '0x08042FAC'],
  [
    0xd6,
    5,
    'StartChUse … StartCurChan2',
    'Start-up channel: enable bit 0; zones A/B; channels A/B (idx1, at most 250)',
    '0x080DD588, F282',
  ],
  [
    0xdb,
    8,
    'CurRoamZone … LastHeardChanSet',
    'Roaming zone (runtime); repeater check on / interval 5–50 s / times 1–3; roam start condition; TX backlight delay; separate display; keep last caller on channel change',
    S46,
  ],
  [0xe4, 1, 'OutRepNote', 'Out-of-range note 0–2', S46],
  [0xe5, 1, 'RxDimWait', NEVER, S47, NR],
  [0xe6, 1, 'TimeRoamOn', 'Auto roaming', S46],
  [0xe7, 1, 'RoamEffectChanDis', NEVER, S47, NR],
  [
    0xe8,
    5,
    'FixTimeMute, OutNoteTimes, StartResetEn, BhtHoldTime, BhtHoldDelay',
    'Mute (n + 1) × 600 ticks; notify n + 1 times; start-up reset; Bluetooth hold 0 off, 1–30 s, 31 60 s, 32 120 s, 33 infinite; Bluetooth RX delay 0 = 30 ms, else (5n + 5) / 10 s (above 10 reads as 0)',
    S46,
  ],
  [
    0xef,
    4,
    'WxAlarmSign, BhtPttHold, UhfAutoRep2, VhfAutoRep2',
    'NOAA alert; Bluetooth PTT hold; auto-repeater 2 offset index (idx1)',
    S46,
  ],
  [0xf3, 1, '(unnamed)', NEVER, S47, NR],
  [0xf4, 16, 'AutoRepMin/MaxV2/U2', 'Auto-repeater 2 limits, 4 × u32 LE 10 Hz', 'F215'],
  [
    0x104,
    3,
    'PttSleepTime, GpsMode, SteTime',
    'Bluetooth PTT sleep 0–4; GNSS 0–6 (GPS … All); STE time 1–100 (0 or above 100 reads as 25)',
    'docs §4.3',
  ],
  [
    0x10c,
    1,
    'TxAgcCon',
    'TX Pow AGC: non-zero drops one power tier while 0x2001AFAE / 0x2001AFAF is set (what sets them is not traced). Meaning inferred',
    '0x0811A75C',
    'meaning',
    'partly',
  ],
  [
    0x110,
    1,
    'ChanDisCtr (bits 3–7)',
    'No reader. Bits 0–2 (channel-type icon, time-slot icon, "C"+colour code / "R"+RAN on NXDN) are the registered fields',
    '0x080713B4 → 0x08072400, 0x080737B0',
    'no-reader',
    'traced',
  ],
  [0x114, 1, 'ZoneBarsEn', 'GPS roaming; runtime; cleared in repeater mode', 'docs §4.3'],
  [0x115, 1, '(unnamed)', NEVER, S47, NR],
  [0x116, 40, 'Alert-tone rows 4–5', 'As the rows at +0x72', '0x0801CAA0'],
  [
    0x13e,
    5,
    'CurWxChan, AmChanVfo, CurAmChan, AmOffset, AmSqLevel',
    'NOAA channel 0–9; AM VFO/MEM; AM channel (runtime); AM offset; AM squelch 0–5',
    S46,
  ],
  [
    0x144,
    3,
    'RepCcLimit, RepSlotPathA/B',
    'Repeater colour-code limit 0 any, 1 A, 2 B; slot paths',
    'N6',
  ],
  [
    0x14a,
    3,
    'DcsSte, BtNrBefore/After',
    'DCS tail 134.4 / 55.2 Hz; Bluetooth noise reduction 0–5',
    S46,
  ],
  [
    0x14e,
    7,
    'SateLocalKind … ResetDigiProtocal',
    'Satellite location / power / squelch / AOS (runtime); protocol (stock forces 0 at load; MM9PDY forces 0 unless unlocked); NXDN mic gain; +0x154 is loaded but ineffective (F302)',
    'docs §4.3, fw/src/cfg.c',
  ],
  [
    0x157,
    6,
    'NOAA Moni, NOAA Scan, AM step, Rep ID limit, Sub SpkInTx, BT rename',
    'NOAA monitor (runtime) / scan; AM step as +0x08; repeater whitelist; sub audio in TX; "U" renames the Bluetooth module, then clears',
    'F213',
  ],
  [0x15d, 3, '(unnamed)', 'No code refers to these bytes', 'docs §2.3', 'unreferenced'],
];

export const AT_D890_NAMED_SETTING_RANGES: readonly AtD890NamedSettingRange[] = ROWS.map(
  ([offset, length, name, meaning, evidence, kind, confidence]) => ({
    offset,
    length,
    name,
    meaning,
    kind: kind ?? 'meaning',
    confidence: confidence ?? 'traced',
    evidence,
    ...(kind === 'no-reader' ? { mask: 0xf8 } : {}),
  }),
);
