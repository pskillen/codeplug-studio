/**
 * Debug-only confidence and evidence for the registered AT-D890UV settings fields, keyed by field id.
 * Display only: the write registry (`settingsFields.ts`) and Studio's Write never read this.
 *
 * Source: `docs/reference/radios/anytone/at-d890uv/optional-settings.md`, which records the
 * V1.05 stock firmware decompile (load clamps, readers, menu lists) and the emulator, never a radio.
 * Rule: `traced` only where that page names a clamp, a reader, a drawer or an emulator result for the
 * field; `partially-traced` where its meaning rests on a menu list or the CPS alone, or where the page
 * lists an open radio check. A field with no entry here shows `unknown` on purpose (none today).
 */
import type { Confidence } from '../../debugView/index.ts';

export interface AtD890FieldConfidence {
  confidence: Confidence;
  evidence: string;
}

const CLAMP = 'Firmware load clamp (V1.05 decompile)';
const MENU = 'Radio menu list (V1.05 decompile); no clamp or reader cited';
const HANG = 'Hang-time reader: below 31 is n * 100 ticks, 31 and above fixed (V1.05 decompile)';
const OTA = 'Tested by the over-the-air handlers; no trace detail on the reference page';
const POWER_ON_LINE =
  'UTF-16LE layout and 14-character cap from static findings; radio check pending';

const t = (evidence: string): AtD890FieldConfidence => ({ confidence: 'traced', evidence });
const p = (evidence: string): AtD890FieldConfidence => ({
  confidence: 'partially-traced',
  evidence,
});

const KEY_NO_CLAMP = p(
  'Indexes a function table with no range check (firmware F217); the 65 stock functions follow the CPS names',
);

export const AT_D890_FIELD_CONFIDENCE: Readonly<Record<string, AtD890FieldConfidence>> = {
  callDisplayMode: t(`${CLAMP}: above 1 becomes 0; value 2 booted in the emulator`),
  callSignColour: t('Firmware colour table (V1.05 decompile)'),
  lastCaller: p(`${CLAMP}: above 3 becomes 3; value order is the CPS's, not firmware-confirmed`),
  aliasDisplayPriority: t(`${CLAMP}: above 2 becomes 0`),
  aliasTxFormat: p(MENU),
  showCurrentContact: p('CPS control only; no firmware reader cited'),
  channelNumberStyle: t('Firmware tests the byte == 0 (V1.05 decompile)'),
  showChannelType: t('Bit 0 gates the channel-type drawer (F354); ANA badge shown in the emulator'),
  showTimeSlot: p('Bit 1 by the time-slot drawer code (F354); no DMR screenshot'),
  showColourCode: p('Bit 2 by the colour-code drawers (F354); no DMR screenshot'),
  powerOnScreen: t(`${CLAMP}: above 2 becomes 0`),
  powerOnLine1: p(POWER_ON_LINE),
  powerOnLine2: p(POWER_ON_LINE),
  startupTone: t(`${CLAMP}: above 1 becomes 1`),
  powerOnVolumeType: t('Firmware start-up code: 0 uses +0x156, anything else the knob'),
  powerOnVolumeLevel: t('Start-up code (above 14 is 15) then a firmware level table'),
  volumeBar: t('Read only by the volume popup, tested != 0 (V1.05 decompile)'),
  maxVolume: t(`${CLAMP}: above 8 becomes 8`),
  maxHeadphoneVolume: p(MENU),
  audioProfile: t(`${CLAMP}: above 3 becomes 0`),
  rxNoiseReduction: p(`${MENU}; key function 59 rewrites it`),
  txNoiseReduction: p(`${MENU}; key function 60 rewrites it`),
  rxDrc: p(MENU),
  dmrMicGain: p(MENU),
  analogueMicGain: p(MENU),
  keyTone: t(`${CLAMP}: above 1 becomes 1`),
  talkPermitTone: p(MENU),
  callResetTone: p(MENU),
  digitalIdleTone: p(MENU),
  analogueIdleTone: t(`${CLAMP}: above 1 becomes 0`),
  smsAlert: t(`${CLAMP}: above 1 becomes 0`),
  callAlert: t(`${CLAMP}: above 1 becomes 0`),
  displayMode: p(`${MENU}; key function 49 rewrites it`),
  backlightLevel: p(MENU),
  backlightTimeout: t(
    'Firmware 16-entry timeout table (V1.05 decompile); entries 13 and 14 differ from the menu text',
  ),
  menuExitTime: t(`${CLAMP}: above 11 becomes 2`),
  standbyTextColour: t(`${CLAMP}: above 7 becomes 0`),
  channelNameColourA: t(`${CLAMP}: above 6 becomes 0`),
  channelNameColourB: t(`${CLAMP}: above 6 becomes 0`),
  zoneNameColourA: t(`${CLAMP}: above 6 becomes 0`),
  zoneNameColourB: t(`${CLAMP}: above 6 becomes 0`),
  standbyBackground: t(`${CLAMP}: above 2 becomes 2`),
  nightMode: p(MENU),
  clockOnStandby: t(`${CLAMP}: above 1 becomes 1`),
  dateFormat: t(`${CLAMP}: above 1 becomes 0`),
  timeZone: t('Reader clamp (above 0x21 becomes 0x19) and the firmware list of 34 labels'),
  keyShortPF1: KEY_NO_CLAMP,
  keyShortPF2: KEY_NO_CLAMP,
  keyShortPF3: KEY_NO_CLAMP,
  keyShortP1: KEY_NO_CLAMP,
  keyShortP2: KEY_NO_CLAMP,
  keyLongPF1: KEY_NO_CLAMP,
  keyLongPF2: KEY_NO_CLAMP,
  keyLongPF3: KEY_NO_CLAMP,
  keyLongP1: KEY_NO_CLAMP,
  keyLongP2: KEY_NO_CLAMP,
  longPressTime: t(`${CLAMP}: above 4 becomes 0`),
  autoPowerOff: p(`${MENU}; counter shares the 100 ms block`),
  autoPowerOffType: t(`${CLAMP}: above 1 becomes 0`),
  txTimeout: p("Radio's 9-entry list; no load clamp"),
  txTimeoutPreAlert: t(`${CLAMP}: above 1 becomes 1`),
  powerSave: p(MENU),
  groupCallHangTime: t(HANG),
  privateCallHangTime: t(HANG),
  manualDialGroupHangTime: t(`${CLAMP}: 0 becomes 1`),
  manualDialPrivateHangTime: t(`${CLAMP}: 0 becomes 1`),
  analogueCallHold: p(
    'Reader scales n * 10 ticks and tests non-zero; the unit (seconds) has no on-air timing',
  ),
  txPreamble: t('Preamble reader uses 5 for any value below 5 in DMR (V1.05 decompile)'),
  voiceHeaderRepeats: t(`${CLAMP}: above 10 becomes 2`),
  smsFormat: t(`${CLAMP}: above 2 becomes 0`),
  missedCallFilterOwnId: p('CPS control only; no firmware reader cited'),
  language: t('LocalInfo +0x04 forces the language at every load (firmware repo)'),
  powerOnPasswordEnabled: t('Boot prompt gate on +0x07 and password byte 0 (firmware F218)'),
  powerOnPasswordDigits: t('Boot compare loop, up to 8 characters (firmware F218)'),
  professionalMode: t('Firmware clamp to 1; hides VFO and menus (V1.05 decompile)'),
  repeaterMode: t('Start-up check and load behaviour (firmware F285)'),
  acceptRemoteKill: p(OTA),
  acceptRemoteMonitor: p(OTA),
  answerGpsRequests: p(OTA),
  encryptionType: p('Read by the digital encryption paths; no trace detail on the reference page'),
  autoRepeaterA: p('VFO shift; limits and offset tables not traced here'),
  autoRepeaterB: p('VFO shift; limits and offset tables not traced here'),
};
