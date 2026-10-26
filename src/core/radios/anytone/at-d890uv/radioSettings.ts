/**
 * AT-D890UV radio settings (the optional-settings block): field model and value lists.
 *
 * Vendor-neutral of wire detail: ids, sections, labels, one-line help and the **values Studio offers**.
 * Offsets, masks and encodings live in `integrations/radio-io/radios/at-d890uv/settingsFields.ts`.
 * Value lists follow what the firmware honours (its load clamps), not always what the official CPS
 * offers. Field reference: docs/reference/radios/anytone/at-d890uv/optional-settings.md.
 *
 * Settings are session state in Studio (never part of a build); see `atD890RadioSettingsSession`.
 */

export type AtD890SettingKind = 'enum' | 'boolean' | 'text' | 'level';

/** Where the setting can be changed on the radio itself. `hidden`: firmware honours it, nothing shows it. */
export type AtD890SettingExposure = 'menu' | 'cps' | 'hidden';

export type AtD890SettingSectionId =
  'callDisplay' | 'startup' | 'volumeAudio' | 'tones' | 'display' | 'keys' | 'powerTimers' | 'dmr';

export interface AtD890SettingOption {
  readonly value: number;
  readonly label: string;
  /** Overrides the field's exposure for this value. */
  readonly exposure?: AtD890SettingExposure;
}

export interface AtD890SettingFieldDef {
  readonly id: string;
  readonly section: AtD890SettingSectionId;
  readonly label: string;
  /** One line, user terms. */
  readonly help: string;
  readonly kind: AtD890SettingKind;
  readonly exposure: AtD890SettingExposure;
  /** MM9PDY firmware adds a radio menu row for a field that is CPS-only on stock. */
  readonly mm9pdyExposure?: AtD890SettingExposure;
  readonly advanced: false;
  /** Offered values for `enum` and `level`. */
  readonly options?: readonly AtD890SettingOption[];
  /** Values the radio may hold that Studio shows but does not offer (decoded, never encoded). */
  readonly readOnlyOptions?: readonly AtD890SettingOption[];
  /** `text` only: maximum characters. */
  readonly maxLength?: number;
}

export const AT_D890_SETTING_SECTIONS: readonly {
  readonly id: AtD890SettingSectionId;
  readonly label: string;
}[] = [
  { id: 'callDisplay', label: 'Call display' },
  { id: 'startup', label: 'Start-up' },
  { id: 'volumeAudio', label: 'Volume and audio' },
  { id: 'tones', label: 'Tones' },
  { id: 'display', label: 'Display' },
  { id: 'keys', label: 'Keys' },
  { id: 'powerTimers', label: 'Power and timers' },
  { id: 'dmr', label: 'DMR' },
];

/** Stored value `n` for `from..to`, labelled by `label(n)`. */
function range(from: number, to: number, label: (n: number) => string): AtD890SettingOption[] {
  const out: AtD890SettingOption[] = [];
  for (let n = from; n <= to; n++) out.push({ value: n, label: label(n) });
  return out;
}

function list(labels: readonly string[], first = 0): AtD890SettingOption[] {
  return labels.map((label, i) => ({ value: first + i, label }));
}

/** 65 key functions: stored value, CPS name, radio menu label. */
const KEY_FUNCTION_ROWS: readonly (readonly [number, string, string])[] = [
  [0, 'Off', 'Off'],
  [1, 'Voltage', 'Volt'],
  [2, 'Power', 'TX Power'],
  [3, 'Talk Around', 'TalkAround'],
  [4, 'Reverse', 'Reverse'],
  [5, 'Digital Encryption', 'Digi Encrypt'],
  [6, 'Call', 'Call'],
  [7, 'Vox', 'VOX'],
  [8, 'V/M', 'VFO/MR'],
  [9, 'Sub PTT', 'Sub Ptt'],
  [10, 'Scan', 'Scan'],
  [11, 'AM/FM', 'FM/AM Air'],
  [12, 'Alarm', 'Alarm'],
  [13, 'Record Switch', 'Record Switch'],
  [14, 'Record', 'Record'],
  [15, 'SMS', 'SMS'],
  [16, 'Dial', 'Dial'],
  [17, 'GPS Information', 'GPS Info'],
  [18, 'Monitor', 'Monitor'],
  [19, 'Main Channel Switch', 'Main CH Switch'],
  [20, 'Hot Key 1', 'Hot Key 1'],
  [21, 'Hot Key 2', 'Hot Key 2'],
  [22, 'Hot Key 3', 'Hot Key 3'],
  [23, 'Hot Key 4', 'Hot Key 4'],
  [24, 'Hot Key 5', 'Hot Key 5'],
  [25, 'Hot Key 6', 'Hot Key 6'],
  [26, 'Work Alone', 'Work Alone'],
  [27, 'Nuisance Delete', 'Nuisance delete'],
  [28, 'Digital Monitor', 'Digi Monitor'],
  [29, 'Sub CH Switch', 'Sub Ch Hide'],
  [30, 'Priority Zone', 'Prior Zone'],
  [31, 'VFO Scan', 'Program Scan'],
  [32, 'MIC Sound Quality', 'Enhance Sound'],
  [33, 'LastCall Reply', 'LastCall Reply'],
  [34, 'Channel Type Switch', 'Switch ChType'],
  [35, 'Ranging', 'Ranging'],
  [36, 'Roaming', 'Roaming'],
  [37, 'Channel Ranging', 'Ch Ranging'],
  [38, 'Max Volume', 'Max VOL Set'],
  [39, 'Slot Switch', 'Slot Set'],
  [40, 'APRS Type Switch', 'APRS Type'],
  [41, 'Zone Select', 'Zone Select'],
  [42, 'Timed Roaming Set', 'Roaming Set'],
  [43, 'APRS Set', 'APRS Set'],
  [44, 'Mute timing', 'FixTime Mute'],
  [45, 'CTC/DCS Set', 'CTC/DCS Set'],
  [46, 'TBST Send', 'TBST Send'],
  [47, 'BT Wireless', 'BHT On/Off'],
  [48, 'GPS', 'Gps On/Off'],
  [49, 'Ch.Name', 'Ch.Name'],
  [50, 'CDT Scan', 'CDT Scan'],
  [51, 'APRS Send', 'APRS Send'],
  [52, 'Ana APRS Info', 'Ana APRS Info'],
  [53, 'GPS Roaming', 'GPS Roaming'],
  [54, 'Dim Shut', 'DIM Shut'],
  [55, 'Satellite Predicting', 'Predicting'],
  [56, 'Sq Level', 'Sq Level'],
  [57, 'NOAA Moni', 'NOAA Moni'],
  [58, 'CH Setting', 'CH Set'],
  [59, 'RX NR', 'RX NR Filter'],
  [60, 'TX NR', 'TX NR Filter'],
  [61, 'Repeater', 'Repeater'],
  [62, 'Digital Protocol', 'Protocol'],
  [63, 'Freq Sync', 'Freq Sync'],
  [64, 'Freq Step', 'Freq Step'],
];

export interface AtD890KeyFunction {
  readonly value: number;
  /** Official CPS name. */
  readonly label: string;
  /** Label on the radio's own Key Func menu. */
  readonly radioLabel: string;
}

/** The 65 stock key functions (0..64). The firmware does not range-check the stored byte. */
export const AT_D890_KEY_FUNCTIONS: readonly AtD890KeyFunction[] = KEY_FUNCTION_ROWS.map(
  ([value, label, radioLabel]) => ({ value, label, radioLabel }),
);

/** Highest key function value the firmware has a handler for. */
export const AT_D890_KEY_FUNCTION_MAX = 64;

/** MM9PDY firmware renames four key functions. */
export const AT_D890_MM9PDY_KEY_FUNCTION_NAMES: ReadonlyMap<number, string> = new Map([
  [13, 'TG Previous'],
  [14, 'TG Next'],
  [30, 'Quick Filters'],
  [55, 'S-Meter'],
]);

/** Key function options for a target: MM9PDY changes labels only, never values. */
export function atD890KeyFunctionOptions(target: 'stock' | 'mm9pdy'): AtD890SettingOption[] {
  return AT_D890_KEY_FUNCTIONS.map((k) => ({
    value: k.value,
    label: (target === 'mm9pdy' && AT_D890_MM9PDY_KEY_FUNCTION_NAMES.get(k.value)) || k.label,
  }));
}

/**
 * Menu language, optional settings `+0x05`: 0 English, 1 Chinese, 2 Russian. The firmware does not
 * range-check it; LocalInfo `+0x04` can force it at every load (1 English, 2 Chinese).
 */
export const AT_D890_LANGUAGES: readonly AtD890SettingOption[] = list([
  'English',
  'Chinese',
  'Russian',
]);

const COLOURS_NAME = list(['Orange', 'Red', 'Yellow', 'Green', 'Turquoise', 'Blue', 'White']);
const COLOURS_CALLSIGN: AtD890SettingOption[] = [
  ...COLOURS_NAME,
  { value: 7, label: 'Black', exposure: 'hidden' },
];
const COLOURS_STANDBY = list([
  'White',
  'Black',
  'Orange',
  'Red',
  'Yellow',
  'Green',
  'Turquoise',
  'Blue',
]);

const MAX_VOLUME = [{ value: 0, label: 'Indoor' }, ...range(1, 8, (n) => `Level ${n}`)];
const NOISE_REDUCTION = [{ value: 0, label: 'Off' }, ...range(1, 5, (n) => `Level ${n}`)];
const MIC_GAIN = [...range(0, 4, (n) => `Level ${n + 1}`), { value: 5, label: 'Auto' }];
/** 1..30 s, 31 = 30 min (firmware reader `0x081134F8`). 32 and above read as about 33 min: not offered. */
const HANG_TIME: AtD890SettingOption[] = [
  ...range(1, 30, (n) => `${n} s`),
  { value: 31, label: '30 min' },
];

/** Radio time-zone menu, in order (firmware table at 0x0818E2E0). */
const TIME_ZONES = list([
  'UTC-12:00',
  'UTC-11:00',
  'UTC-10:00',
  'UTC-09:00',
  'UTC-08:00',
  'UTC-07:00',
  'UTC-06:00',
  'UTC-05:00',
  'UTC-04:00',
  'UTC-03:30',
  'UTC-03:00',
  'UTC-02:00',
  'UTC-01:00',
  'UTC',
  'UTC+01:00',
  'UTC+02:00',
  'UTC+03:00',
  'UTC+03:30',
  'UTC+04:00',
  'UTC+04:30',
  'UTC+05:00',
  'UTC+05:30',
  'UTC+05:45',
  'UTC+06:00',
  'UTC+07:00',
  'UTC+08:00',
  'UTC+08:30',
  'UTC+09:00',
  'UTC+09:30',
  'UTC+10:00',
  'UTC+10:30',
  'UTC+11:00',
  'UTC+12:00',
  'UTC+13:00',
]);

type Def = Omit<AtD890SettingFieldDef, 'advanced' | 'kind'>;

const bool = (d: Def): AtD890SettingFieldDef => ({ ...d, kind: 'boolean', advanced: false });
const en = (d: Def): AtD890SettingFieldDef => ({ ...d, kind: 'enum', advanced: false });
const lvl = (d: Def): AtD890SettingFieldDef => ({ ...d, kind: 'level', advanced: false });
const txt = (d: Def): AtD890SettingFieldDef => ({ ...d, kind: 'text', advanced: false });

const KEY_NAMES = [
  ['PF1', 'Short', 'keyShortPF1'],
  ['PF2', 'Short', 'keyShortPF2'],
  ['PF3', 'Short', 'keyShortPF3'],
  ['P1', 'Short', 'keyShortP1'],
  ['P2', 'Short', 'keyShortP2'],
  ['PF1', 'Long', 'keyLongPF1'],
  ['PF2', 'Long', 'keyLongPF2'],
  ['PF3', 'Long', 'keyLongPF3'],
  ['P1', 'Long', 'keyLongP1'],
  ['P2', 'Long', 'keyLongP2'],
] as const;

const KEY_FIELDS: AtD890SettingFieldDef[] = KEY_NAMES.map(([key, press, id]) =>
  en({
    id,
    section: 'keys',
    label: `${key} ${press.toLowerCase()} press`,
    help: `What the ${key} key does on a ${press.toLowerCase()} press.`,
    exposure: 'menu',
    options: AT_D890_KEY_FUNCTIONS.map((k) => ({ value: k.value, label: k.label })),
  }),
);

export const AT_D890_SETTING_FIELDS: readonly AtD890SettingFieldDef[] = [
  // Call display
  en({
    id: 'callDisplayMode',
    section: 'callDisplay',
    label: 'Call display mode',
    help: 'How an incoming DMR call is shown.',
    exposure: 'cps',
    options: [
      { value: 0, label: 'Turn off talker alias' },
      { value: 1, label: 'Call sign based' },
    ],
    readOnlyOptions: [{ value: 2, label: 'Name based (the radio resets this at power-on)' }],
  }),
  en({
    id: 'callSignColour',
    section: 'callDisplay',
    label: 'Call sign colour',
    help: 'Colour of the caller line.',
    exposure: 'cps',
    options: COLOURS_CALLSIGN,
  }),
  en({
    id: 'lastCaller',
    section: 'callDisplay',
    label: 'Last caller',
    help: 'What the last-caller line shows.',
    exposure: 'cps',
    options: list(['Off', 'Display ID', 'Display callsign', 'Show both']),
  }),
  en({
    id: 'aliasDisplayPriority',
    section: 'callDisplay',
    label: 'Alias display priority',
    help: 'Which name wins when a call carries both a contact and a talker alias.',
    exposure: 'menu',
    options: list(['Off', 'Contact first', 'Alias first']),
  }),
  en({
    id: 'aliasTxFormat',
    section: 'callDisplay',
    label: 'Alias TX format',
    help: 'Character set used when the radio sends its talker alias.',
    exposure: 'menu',
    options: list(['ISO 8-bit', 'ISO 7-bit', 'Unicode']),
  }),
  bool({
    id: 'showCurrentContact',
    section: 'callDisplay',
    label: 'Show current contact',
    help: 'Show the transmit contact on the standby screen.',
    exposure: 'cps',
  }),
  en({
    id: 'channelNumberStyle',
    section: 'callDisplay',
    label: 'Channel number',
    help: 'Which number the standby screen shows for a channel.',
    exposure: 'cps',
    options: list(['Actual channel number', 'Sequence number in zone']),
  }),
  bool({
    id: 'showChannelType',
    section: 'callDisplay',
    label: 'Show channel type',
    help: 'Add the channel type to the channel line.',
    exposure: 'cps',
  }),
  bool({
    id: 'showTimeSlot',
    section: 'callDisplay',
    label: 'Show time slot',
    help: 'Add the DMR time slot to the channel line.',
    exposure: 'cps',
  }),
  bool({
    id: 'showColourCode',
    section: 'callDisplay',
    label: 'Show colour code',
    help: 'Add the DMR colour code to the channel line.',
    exposure: 'cps',
  }),

  // Start-up
  en({
    id: 'powerOnScreen',
    section: 'startup',
    label: 'Power-on screen',
    help: 'What the radio shows when it starts.',
    exposure: 'cps',
    options: [
      { value: 0, label: 'Default picture' },
      { value: 1, label: 'Custom text' },
    ],
    readOnlyOptions: [{ value: 2, label: 'Custom picture (cannot be set from Studio)' }],
  }),
  txt({
    id: 'powerOnLine1',
    section: 'startup',
    label: 'Power-on line 1',
    help: 'First start-up text line, up to 16 characters.',
    exposure: 'cps',
    maxLength: 16,
  }),
  txt({
    id: 'powerOnLine2',
    section: 'startup',
    label: 'Power-on line 2',
    help: 'Second start-up text line, up to 16 characters.',
    exposure: 'cps',
    maxLength: 16,
  }),
  bool({
    id: 'startupTone',
    section: 'startup',
    label: 'Start-up tone',
    help: 'Play a tone at power-on.',
    exposure: 'menu',
  }),
  en({
    id: 'powerOnVolumeType',
    section: 'startup',
    label: 'Power-on volume',
    help: 'Start at a fixed level or wherever the knob is.',
    exposure: 'cps',
    options: list(['Fixed level', 'Last knob position']),
  }),
  lvl({
    id: 'powerOnVolumeLevel',
    section: 'startup',
    label: 'Power-on volume level',
    help: 'The fixed level, used when power-on volume is a fixed level.',
    exposure: 'cps',
    options: range(1, 15, (n) => `Level ${n}`),
  }),

  // Volume and audio
  bool({
    id: 'volumeBar',
    section: 'volumeAudio',
    label: 'Volume bar',
    help: 'Show the volume popup when the knob turns.',
    exposure: 'cps',
    mm9pdyExposure: 'menu',
  }),
  en({
    id: 'maxVolume',
    section: 'volumeAudio',
    label: 'Maximum volume',
    help: 'Loudest the volume knob goes.',
    exposure: 'menu',
    options: MAX_VOLUME,
  }),
  en({
    id: 'maxHeadphoneVolume',
    section: 'volumeAudio',
    label: 'Maximum headphone volume',
    help: 'Loudest the volume knob goes with an earpiece.',
    exposure: 'menu',
    options: MAX_VOLUME,
  }),
  en({
    id: 'audioProfile',
    section: 'volumeAudio',
    label: 'Audio profile',
    help: 'Receive and transmit audio tuning.',
    exposure: 'menu',
    options: [
      { value: 0, label: 'Normal' },
      { value: 1, label: 'Mic enhance' },
      { value: 2, label: 'Indoor', exposure: 'hidden' },
      { value: 3, label: 'Outdoor', exposure: 'hidden' },
    ],
  }),
  en({
    id: 'rxNoiseReduction',
    section: 'volumeAudio',
    label: 'RX noise reduction',
    help: 'Noise filter on received audio.',
    exposure: 'menu',
    options: NOISE_REDUCTION,
  }),
  en({
    id: 'txNoiseReduction',
    section: 'volumeAudio',
    label: 'TX noise reduction',
    help: 'Noise filter on transmitted audio.',
    exposure: 'menu',
    options: NOISE_REDUCTION,
  }),
  bool({
    id: 'rxDrc',
    section: 'volumeAudio',
    label: 'RX DRC',
    help: 'Dynamic range control on received audio.',
    exposure: 'menu',
  }),
  en({
    id: 'dmrMicGain',
    section: 'volumeAudio',
    label: 'DMR mic gain',
    help: 'Microphone level on digital channels.',
    exposure: 'menu',
    options: MIC_GAIN,
  }),
  en({
    id: 'analogueMicGain',
    section: 'volumeAudio',
    label: 'Analogue mic gain',
    help: 'Microphone level on analogue channels.',
    exposure: 'menu',
    options: MIC_GAIN,
  }),

  // Tones
  bool({
    id: 'keyTone',
    section: 'tones',
    label: 'Key tone',
    help: 'Beep on key presses.',
    exposure: 'menu',
  }),
  en({
    id: 'talkPermitTone',
    section: 'tones',
    label: 'Talk permit tone',
    help: 'Tone when the radio may transmit.',
    exposure: 'menu',
    options: list(['Off', 'Digital', 'Analogue', 'Both']),
  }),
  bool({
    id: 'callResetTone',
    section: 'tones',
    label: 'Call reset tone',
    help: 'Tone when a digital call resets.',
    exposure: 'menu',
  }),
  en({
    id: 'digitalIdleTone',
    section: 'tones',
    label: 'Digital idle channel tone',
    help: 'Tone when a digital channel is idle.',
    exposure: 'menu',
    options: list(['Off', 'Type 1', 'Type 2', 'Type 3']),
  }),
  bool({
    id: 'analogueIdleTone',
    section: 'tones',
    label: 'Analogue idle channel tone',
    help: 'Tone when an analogue channel is idle.',
    exposure: 'menu',
  }),
  en({
    id: 'smsAlert',
    section: 'tones',
    label: 'SMS alert',
    help: 'Ring when a message arrives.',
    exposure: 'menu',
    options: list(['Off', 'Ring']),
  }),
  en({
    id: 'callAlert',
    section: 'tones',
    label: 'Call alert',
    help: 'Ring on an incoming call alert.',
    exposure: 'menu',
    options: list(['Off', 'Ring']),
  }),

  // Display
  en({
    id: 'displayMode',
    section: 'display',
    label: 'Channel line shows',
    help: 'Channel name or frequency.',
    exposure: 'menu',
    options: list(['Channel name', 'Frequency']),
  }),
  en({
    id: 'backlightLevel',
    section: 'display',
    label: 'Backlight level',
    help: 'Screen brightness.',
    exposure: 'menu',
    options: range(0, 4, (n) => `Level ${n + 1}`),
  }),
  en({
    id: 'backlightTimeout',
    section: 'display',
    label: 'Backlight timeout',
    help: 'How long the backlight stays on.',
    exposure: 'menu',
    options: list([
      'Always',
      '5 s',
      '10 s',
      '15 s',
      '20 s',
      '25 s',
      '30 s',
      '1 min',
      '2 min',
      '3 min',
      '4 min',
      '5 min',
      '15 min',
      '30 min',
      '45 min',
      '1 hour',
    ]),
  }),
  en({
    id: 'menuExitTime',
    section: 'display',
    label: 'Menu exit time',
    help: 'Time without a key press before a menu closes.',
    exposure: 'menu',
    options: range(0, 11, (n) => `${(n + 1) * 5} s`),
  }),
  en({
    id: 'standbyTextColour',
    section: 'display',
    label: 'Standby text colour',
    help: 'Colour of the standby screen text.',
    exposure: 'menu',
    options: COLOURS_STANDBY,
  }),
  en({
    id: 'channelNameColourA',
    section: 'display',
    label: 'Channel A name colour',
    help: 'Colour of the channel A name.',
    exposure: 'menu',
    options: COLOURS_NAME,
  }),
  en({
    id: 'channelNameColourB',
    section: 'display',
    label: 'Channel B name colour',
    help: 'Colour of the channel B name.',
    exposure: 'menu',
    options: COLOURS_NAME,
  }),
  en({
    id: 'zoneNameColourA',
    section: 'display',
    label: 'Zone A name colour',
    help: 'Colour of the zone A name.',
    exposure: 'menu',
    options: COLOURS_NAME,
  }),
  en({
    id: 'zoneNameColourB',
    section: 'display',
    label: 'Zone B name colour',
    help: 'Colour of the zone B name.',
    exposure: 'menu',
    options: COLOURS_NAME,
  }),
  en({
    id: 'standbyBackground',
    section: 'display',
    label: 'Standby background',
    help: 'Picture behind the standby screen.',
    exposure: 'menu',
    options: [{ value: 0, label: 'Default picture' }],
    readOnlyOptions: [
      { value: 1, label: 'Custom picture 1 (cannot be set from Studio)' },
      { value: 2, label: 'Custom picture 2 (cannot be set from Studio)' },
    ],
  }),
  bool({
    id: 'nightMode',
    section: 'display',
    label: 'Night mode',
    help: 'Dim colour scheme.',
    exposure: 'menu',
  }),
  bool({
    id: 'clockOnStandby',
    section: 'display',
    label: 'Clock on standby',
    help: 'Show the time on the standby screen.',
    exposure: 'menu',
  }),
  en({
    id: 'dateFormat',
    section: 'display',
    label: 'Date format',
    help: 'Order of the date parts.',
    exposure: 'menu',
    options: list(['yyyy/m/d', 'd/m/yyyy']),
  }),
  en({
    id: 'timeZone',
    section: 'display',
    label: 'Time zone',
    help: 'Offset from UTC used for the clock.',
    exposure: 'menu',
    options: TIME_ZONES,
  }),

  // Keys
  ...KEY_FIELDS,
  en({
    id: 'longPressTime',
    section: 'keys',
    label: 'Long-press time',
    help: 'How long a key is held to count as a long press.',
    exposure: 'cps',
    options: range(0, 4, (n) => `${n + 1} s`),
  }),

  // Power and timers
  en({
    id: 'autoPowerOff',
    section: 'powerTimers',
    label: 'Auto power-off',
    help: 'Switch off after this long without use.',
    exposure: 'menu',
    options: list(['Off', '10 min', '30 min', '60 min', '120 min']),
  }),
  en({
    id: 'autoPowerOffType',
    section: 'powerTimers',
    label: 'Auto power-off type',
    help: 'Whether calls restart the auto power-off timer.',
    exposure: 'cps',
    options: list(['Reset by calls', 'Not reset by calls']),
  }),
  en({
    id: 'txTimeout',
    section: 'powerTimers',
    label: 'TX timeout',
    help: 'Longest single transmission.',
    exposure: 'menu',
    options: [{ value: 0, label: 'Off' }, ...range(1, 8, (n) => `${n * 30} s`)],
  }),
  bool({
    id: 'txTimeoutPreAlert',
    section: 'powerTimers',
    label: 'TX timeout pre-alert',
    help: 'Warn shortly before the transmit timeout.',
    exposure: 'menu',
  }),
  en({
    id: 'powerSave',
    section: 'powerTimers',
    label: 'Power save',
    help: 'Battery save ratio.',
    exposure: 'menu',
    options: list(['Off', '1:1', '2:1']),
  }),

  // DMR
  lvl({
    id: 'groupCallHangTime',
    section: 'dmr',
    label: 'Group call hang time',
    help: 'How long the radio stays on a group call after it ends.',
    exposure: 'cps',
    options: HANG_TIME,
  }),
  lvl({
    id: 'privateCallHangTime',
    section: 'dmr',
    label: 'Private call hang time',
    help: 'How long the radio stays on a private call after it ends.',
    exposure: 'cps',
    options: HANG_TIME,
  }),
  lvl({
    id: 'manualDialGroupHangTime',
    section: 'dmr',
    label: 'Manual dial group hang time',
    help: 'Hang time after a manually dialled group call.',
    exposure: 'cps',
    options: HANG_TIME,
  }),
  lvl({
    id: 'manualDialPrivateHangTime',
    section: 'dmr',
    label: 'Manual dial private hang time',
    help: 'Hang time after a manually dialled private call.',
    exposure: 'cps',
    options: HANG_TIME,
  }),
  lvl({
    id: 'analogueCallHold',
    section: 'dmr',
    label: 'Analogue call hold time',
    help: 'Hold time on analogue channels (units as in the official CPS).',
    exposure: 'cps',
    options: range(1, 30, (n) => `${n} s`),
  }),
  lvl({
    id: 'txPreamble',
    section: 'dmr',
    label: 'TX preamble duration',
    help: 'Digital preamble sent before a transmission.',
    exposure: 'menu',
    options: range(0, 40, (n) => `${n * 60} ms`),
  }),
  lvl({
    id: 'voiceHeaderRepeats',
    section: 'dmr',
    label: 'Voice header repetitions',
    help: 'How often the voice header is repeated.',
    exposure: 'menu',
    options: range(2, 10, (n) => String(n)),
  }),
  en({
    id: 'smsFormat',
    section: 'dmr',
    label: 'SMS format',
    help: 'Text message encoding.',
    exposure: 'menu',
    options: list(['M-SMS', 'H-SMS', 'DMR standard']),
  }),
  bool({
    id: 'missedCallFilterOwnId',
    section: 'dmr',
    label: 'Filter own ID in missed calls',
    help: 'Do not list calls from your own ID as missed.',
    exposure: 'cps',
  }),
];

const FIELD_BY_ID: ReadonlyMap<string, AtD890SettingFieldDef> = new Map(
  AT_D890_SETTING_FIELDS.map((f) => [f.id, f]),
);

/** Field ids in display order (section order, then declaration order). */
export const AT_D890_V1_SETTINGS_FIELD_IDS: readonly string[] = AT_D890_SETTING_SECTIONS.flatMap(
  (s) => AT_D890_SETTING_FIELDS.filter((f) => f.section === s.id).map((f) => f.id),
);

export function atD890SettingField(id: string): AtD890SettingFieldDef | undefined {
  return FIELD_BY_ID.get(id);
}

/** Label for a raw wire value, offered or read-only; `undefined` when the field has none. */
export function atD890SettingOptionLabel(id: string, value: number): string | undefined {
  const f = FIELD_BY_ID.get(id);
  return (
    f?.options?.find((o) => o.value === value)?.label ??
    f?.readOnlyOptions?.find((o) => o.value === value)?.label
  );
}
