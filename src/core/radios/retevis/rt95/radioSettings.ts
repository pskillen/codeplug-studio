/**
 * RT95 radio settings: field model and value lists (no wire addresses).
 *
 * Wire specs live in `integrations/radio-io/radios/rt95/settingsFields.ts`.
 * Reference: docs/reference/radios/retevis/rt95/settings.md.
 */

export type Rt95SettingKind = 'enum' | 'boolean' | 'text' | 'password' | 'dtmfCode';

export type Rt95SettingSectionId =
  'functionSetup' | 'vox' | 'keys' | 'dtmf' | 'startup' | 'advanced';

export interface Rt95SettingOption {
  readonly value: number;
  readonly label: string;
}

export interface Rt95SettingFieldDef {
  readonly id: string;
  readonly section: Rt95SettingSectionId;
  /** CPS label text where recovered. */
  readonly label: string;
  readonly help: string;
  readonly kind: Rt95SettingKind;
  readonly advanced: boolean;
  readonly warning?: string;
  readonly options?: readonly Rt95SettingOption[];
  readonly maxLength?: number;
}

export const RT95_SETTING_SECTIONS: readonly {
  readonly id: Rt95SettingSectionId;
  readonly label: string;
}[] = [
  { id: 'startup', label: 'Display' },
  { id: 'functionSetup', label: 'Function setup' },
  { id: 'vox', label: 'VOX' },
  { id: 'keys', label: 'PF keys' },
  { id: 'dtmf', label: 'DTMF' },
  { id: 'advanced', label: 'Advanced' },
];

function list(labels: readonly string[], first = 0): Rt95SettingOption[] {
  return labels.map((label, i) => ({ value: first + i, label }));
}

function range(from: number, to: number, label: (n: number) => string): Rt95SettingOption[] {
  const out: Rt95SettingOption[] = [];
  for (let n = from; n <= to; n++) out.push({ value: n, label: label(n) });
  return out;
}

/** PF / front-panel key functions (CHIRP list index; wire stores index + 1). */
export const RT95_PF_KEY_LABELS: readonly string[] = [
  'A/B',
  'V/M',
  'SQL',
  'VOL',
  'POW',
  'CDT',
  'REV',
  'SCN',
  'CAL',
  'TALK',
  'BND',
  'SFT',
  'MON',
  'DIR',
  'TRF',
  'RDW',
  'VOX',
  'NULL',
];

export const RT95_PF_KEY_OPTIONS: readonly Rt95SettingOption[] = RT95_PF_KEY_LABELS.map(
  (label, i) => ({ value: i, label }),
);

export const RT95_STARTING_DISPLAY_MAX_LENGTH = 7;
export const RT95_POWER_ON_PASSWORD_DIGITS = 6;

export const RT95_POWER_ON_PASSWORD_FIELD_IDS: readonly string[] = [
  'powerOnPasswordEnabled',
  'powerOnPasswordDigits',
];

const BEEP_VOLUME = list(['Off', '1', '2', '3', '4', '5']);
const BACKLIGHT = range(1, 3, (n) => String(n));
const SPEAKER_VOLUME = range(1, 36, (n) => String(n));
const SPEAKER_SWITCH = list([
  'Host On | Hand Mic Off',
  'Host On | Hand Mic On',
  'Host Off | Hand Mic On',
]);
const STE_FREQUENCY = list(['Off', '55.2 Hz', '259.2 Hz']);
const STE_TYPE = list(['Off', 'Silent', '120 Degree', '180 Degree', '240 Degree']);
const AUTO_POWER_OFF = list(['Off', '30 Minute', '60 Minute', '120 Minute']);
const SQUELCH: Rt95SettingOption[] = [{ value: 0, label: 'Off' }, ...range(1, 9, (n) => String(n))];
const SCAN_TYPE = list(['TO', 'CO', 'SE']);
const SCAN_RECOVERY = list(['5 Second', '10 Second', '15 Second']);
const MAIN = list(['A', 'B']);
const TOT: Rt95SettingOption[] = [
  { value: 0, label: 'Off' },
  ...range(1, 30, (n) => `${n} Minute`),
];
const TBST = list(['1000Hz', '1450Hz', '1750Hz', '2100Hz']);
const MON_KEY = list(['Squelch Off Momentary', 'Squelch Off']);
const FREQ_STEP = list(['2.5K', '5K', '6.25K', '10K', '12.5K', '20K', '25K', '30K', '50K']);
const KNOB_MODE = list(['VOL', 'CH']);
const DTMF_TX_TIME = list(['50 ms', '100 ms', '200 ms', '300 ms', '500 ms']);
const VOX_DELAY = list([
  '0.5 S',
  '1.0 S',
  '1.5 S',
  '2.0 S',
  '2.5 S',
  '3.0 S',
  '3.5 S',
  '4.0 S',
  '4.5 S',
]);
const VOX_LEVEL = range(1, 9, (n) => String(n));
const DISPLAY_MODE = list(['Frequency', 'Channel', 'Name']);

const DTMF_INTERVAL = list(['A', 'B', 'C', 'D', '*', '#']);
const DTMF_GROUP = list(['Off', 'A', 'B', 'C', 'D', '*', '#']);
const DTMF_DECODE = list(['None', 'Beep', 'Beep and respond']);
const DTMF_PRETIME = range(0, 249, (n) => String((n + 1) * 10));
const DTMF_FIRST_DIGIT = range(0, 250, (n) => String(n * 10));
const DTMF_LAPSE = range(0, 249, (n) => String((n + 1) * 10));
const DTMF_PAUSE = [
  { value: 0, label: 'Off' },
  { value: 1, label: '-' },
  { value: 2, label: '-' },
  { value: 3, label: '-' },
  { value: 4, label: '-' },
  ...range(5, 75, (n) => String(n)),
];

type Def = Omit<Rt95SettingFieldDef, 'advanced' | 'kind'>;
type AdvDef = Omit<Def, 'section'> & { readonly warning: string };

const bool = (d: Def): Rt95SettingFieldDef => ({ ...d, kind: 'boolean', advanced: false });
const en = (d: Def): Rt95SettingFieldDef => ({ ...d, kind: 'enum', advanced: false });
const txt = (d: Def): Rt95SettingFieldDef => ({ ...d, kind: 'text', advanced: false });
const dtmf = (d: Def): Rt95SettingFieldDef => ({ ...d, kind: 'dtmfCode', advanced: false });
const advBool = (d: AdvDef): Rt95SettingFieldDef => ({
  ...d,
  section: 'advanced',
  kind: 'boolean',
  advanced: true,
});
const advDtmf = (d: AdvDef): Rt95SettingFieldDef => ({
  ...d,
  section: 'advanced',
  kind: 'dtmfCode',
  advanced: true,
});

const PF_KEY_IDS = [
  'pfKeyMode1P1',
  'pfKeyMode1P2',
  'pfKeyMode1P3',
  'pfKeyMode1P4',
  'pfKeyMode1P5',
  'pfKeyMode1P6',
  'pfKeyMode2P1',
  'pfKeyMode2P2',
  'pfKeyMode2P3',
  'pfKeyMode2P4',
  'pfKeyMode2P5',
  'pfKeyMode2P6',
] as const;

const PF_KEY_FIELDS: Rt95SettingFieldDef[] = PF_KEY_IDS.map((id, i) => {
  const group = i < 6 ? 1 : 2;
  const key = (i % 6) + 1;
  return en({
    id,
    section: 'keys',
    label: `Key mode ${group} P${key}`,
    help: `PF key assignment for group ${group}, key P${key}.`,
    options: RT95_PF_KEY_OPTIONS,
  });
});

const PTT_ID_FIELDS: Rt95SettingFieldDef[] = Array.from({ length: 16 }, (_, i) =>
  dtmf({
    id: `pttIdM${i + 1}`,
    section: 'dtmf',
    label: `PTT-ID M${i + 1}`,
    help: 'DTMF code sent for this PTT-ID slot.',
    maxLength: 16,
  }),
);

export const RT95_SETTING_FIELDS: readonly Rt95SettingFieldDef[] = [
  txt({
    id: 'startingDisplay',
    section: 'startup',
    label: 'Starting Display',
    help: 'Text shown at power-on (up to seven characters).',
    maxLength: RT95_STARTING_DISPLAY_MAX_LENGTH,
  }),
  en({
    id: 'displayMode',
    section: 'functionSetup',
    label: 'Display Mode',
    help: 'Default display style on the radio.',
    options: DISPLAY_MODE,
  }),
  en({
    id: 'backlightBrightness',
    section: 'functionSetup',
    label: 'Backlight Brightness',
    help: 'Display backlight level.',
    options: BACKLIGHT,
  }),
  en({
    id: 'screenDirection',
    section: 'functionSetup',
    label: 'Screen Direction',
    help: 'LCD orientation.',
    options: list(['Positive', 'Inverted']),
  }),
  en({
    id: 'beepVolume',
    section: 'functionSetup',
    label: 'Beep Volume',
    help: 'Key/beep loudness.',
    options: BEEP_VOLUME,
  }),
  en({
    id: 'speakerVolume',
    section: 'functionSetup',
    label: 'Speaker Volume',
    help: 'Default speaker level.',
    options: SPEAKER_VOLUME,
  }),
  en({
    id: 'speakerSwitch',
    section: 'functionSetup',
    label: 'Speaker Switch',
    help: 'Host vs hand-mic audio routing.',
    options: SPEAKER_SWITCH,
  }),
  en({
    id: 'steFrequency',
    section: 'functionSetup',
    label: 'STE Frequency',
    help: 'Stealth tone frequency.',
    options: STE_FREQUENCY,
  }),
  en({
    id: 'steType',
    section: 'functionSetup',
    label: 'STE Type',
    help: 'Stealth tone shape.',
    options: STE_TYPE,
  }),
  bool({
    id: 'autoPowerOn',
    section: 'functionSetup',
    label: 'Auto Power On',
    help: 'Power on when external power is applied.',
  }),
  en({
    id: 'autoPowerOff',
    section: 'functionSetup',
    label: 'Auto Power Off',
    help: 'Automatic shut-down timer.',
    options: AUTO_POWER_OFF,
  }),
  en({
    id: 'squelchLevelA',
    section: 'functionSetup',
    label: 'Squelch Level A',
    help: 'Squelch for main A.',
    options: SQUELCH,
  }),
  en({
    id: 'squelchLevelB',
    section: 'functionSetup',
    label: 'Squelch Level B',
    help: 'Squelch for main B.',
    options: SQUELCH,
  }),
  en({
    id: 'scanType',
    section: 'functionSetup',
    label: 'Scan Type',
    help: 'Scan mode (TO / CO / SE).',
    options: SCAN_TYPE,
  }),
  en({
    id: 'scanRecoveryTime',
    section: 'functionSetup',
    label: 'Scan Recovery Time',
    help: 'Delay before scan resumes.',
    options: SCAN_RECOVERY,
  }),
  en({
    id: 'main',
    section: 'functionSetup',
    label: 'Main',
    help: 'Active main (A or B).',
    options: MAIN,
  }),
  bool({
    id: 'rxWaySelect',
    section: 'functionSetup',
    label: 'RX Way Select',
    help: 'Single or dual receive.',
  }),
  en({
    id: 'timeOutTimer',
    section: 'functionSetup',
    label: 'Time Out Timer',
    help: 'Transmit time-out limit.',
    options: TOT,
  }),
  en({
    id: 'tbstFrequency',
    section: 'functionSetup',
    label: 'TBST Frequency',
    help: 'Tone burst frequency.',
    options: TBST,
  }),
  bool({
    id: 'saveChannelParameter',
    section: 'functionSetup',
    label: 'Save Channel Parameter',
    help: 'Save edits back to the channel.',
  }),
  en({
    id: 'monKeyFunction',
    section: 'functionSetup',
    label: 'MON Key Function',
    help: 'Monitor key behaviour.',
    options: MON_KEY,
  }),
  en({
    id: 'frequencyStep',
    section: 'functionSetup',
    label: 'Frequency Step',
    help: 'VFO tuning step.',
    options: FREQ_STEP,
  }),
  en({
    id: 'knobMode',
    section: 'functionSetup',
    label: 'Knob Mode',
    help: 'Front knob controls volume or channel.',
    options: KNOB_MODE,
  }),
  bool({
    id: 'voxOnOff',
    section: 'vox',
    label: 'VOX On/Off',
    help: 'Voice-operated transmit.',
  }),
  en({
    id: 'voxLevel',
    section: 'vox',
    label: 'VOX Level',
    help: 'VOX sensitivity.',
    options: VOX_LEVEL,
  }),
  en({
    id: 'voxDelay',
    section: 'vox',
    label: 'VOX Delay',
    help: 'Hang time after speech stops.',
    options: VOX_DELAY,
  }),
  ...PF_KEY_FIELDS,
  en({
    id: 'dtmfTxTime',
    section: 'dtmf',
    label: 'DTMF Transmitting Time',
    help: 'Length of each DTMF digit on the air.',
    options: DTMF_TX_TIME,
  }),
  ...PTT_ID_FIELDS,
  dtmf({
    id: 'pttIdStart',
    section: 'dtmf',
    label: 'PTT ID start',
    help: 'Opening DTMF ID sequence.',
    maxLength: 16,
  }),
  dtmf({
    id: 'pttIdEnd',
    section: 'dtmf',
    label: 'PTT ID end',
    help: 'Closing DTMF ID sequence.',
    maxLength: 16,
  }),
  en({
    id: 'dtmfIntervalChar',
    section: 'dtmf',
    label: 'Interval character',
    help: 'DTMF digit sent between ID bursts.',
    options: DTMF_INTERVAL,
  }),
  en({
    id: 'dtmfGroupCode',
    section: 'dtmf',
    label: 'Group code',
    help: 'DTMF group code filter.',
    options: DTMF_GROUP,
  }),
  en({
    id: 'dtmfDecodingResponse',
    section: 'dtmf',
    label: 'Decoding response',
    help: 'Beep when a DTMF code is received.',
    options: DTMF_DECODE,
  }),
  en({
    id: 'dtmfPretime',
    section: 'dtmf',
    label: 'Pretime',
    help: 'Delay before DTMF is sent (ms).',
    options: DTMF_PRETIME,
  }),
  en({
    id: 'dtmfFirstDigitTime',
    section: 'dtmf',
    label: 'First digit time',
    help: 'First-digit delay (ms).',
    options: DTMF_FIRST_DIGIT,
  }),
  txt({
    id: 'dtmfSelfId',
    section: 'dtmf',
    label: 'Self ID',
    help: 'Three-digit self ID.',
    maxLength: 3,
  }),
  bool({
    id: 'dtmfSideTone',
    section: 'dtmf',
    label: 'Side tone',
    help: 'Audible side tone while sending DTMF.',
  }),
  en({
    id: 'dtmfTimeLapse',
    section: 'dtmf',
    label: 'Time-lapse after encode',
    help: 'Pause after encoding (ms).',
    options: DTMF_LAPSE,
  }),
  en({
    id: 'dtmfPttIdPause',
    section: 'dtmf',
    label: 'PTT ID pause',
    help: 'Pause before PTT ID (seconds).',
    options: DTMF_PAUSE,
  }),
  advBool({
    id: 'powerOnPasswordEnabled',
    label: 'Power-on password',
    help: 'Require digits at power-on.',
    warning: 'A wrong password can lock the radio at boot.',
  }),
  {
    id: 'powerOnPasswordDigits',
    section: 'advanced',
    label: 'Password digits',
    help: 'Six digits (0–9) for the power-on password.',
    kind: 'password',
    advanced: true,
    warning: 'Must match the enable switch; six digits when enabled.',
  },
  advBool({
    id: 'powerOnResetEnable',
    label: 'Power On Reset Enable',
    help: 'Allows factory reset from the front panel.',
    warning: 'Can wipe the codeplug when combined with the reset key sequence.',
  }),
  advBool({
    id: 'trfEnable',
    label: 'TRF Enable',
    help: 'Transmitter-related function (meaning not fully recovered).',
    warning: 'Affects the transmit path; change only if you understand the risk.',
  }),
  advBool({
    id: 'channelLocked',
    label: 'Channel Locked',
    help: 'Prevents editing channels on the radio.',
    warning: 'Locks channel programming until cleared.',
  }),
  advDtmf({
    id: 'remoteStun',
    label: 'Remote stun',
    help: 'DTMF code that can disable another radio.',
    warning: 'Can disable a radio that receives this code.',
    maxLength: 16,
  }),
  advDtmf({
    id: 'remoteKill',
    label: 'Remote kill',
    help: 'DTMF code that can kill another radio.',
    warning: 'Can permanently disable a radio that receives this code.',
    maxLength: 16,
  }),
];

const FIELD_BY_ID = new Map(RT95_SETTING_FIELDS.map((f) => [f.id, f]));

export const RT95_ADVANCED_SETTINGS_FIELD_IDS: readonly string[] = RT95_SETTING_FIELDS.filter(
  (f) => f.advanced,
).map((f) => f.id);

export const RT95_ALL_SETTINGS_FIELD_IDS: readonly string[] = RT95_SETTING_FIELDS.map((f) => f.id);

export function rt95SettingField(id: string): Rt95SettingFieldDef | undefined {
  return FIELD_BY_ID.get(id);
}

export function rt95SettingOptionLabel(id: string, value: number): string | undefined {
  const f = FIELD_BY_ID.get(id);
  return f?.options?.find((o) => o.value === value)?.label;
}

export function rt95PfKeyOptionLabel(index: number): string | undefined {
  return RT95_PF_KEY_LABELS[index];
}
