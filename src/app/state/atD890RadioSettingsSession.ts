/**
 * AT-D890UV radio settings: per-build session state (#1393).
 *
 * Overrides, and the values read from a radio, live in memory until the page is refreshed. They are
 * never written to the build, `RadioBuild.exportSettings`, IndexedDB, localStorage or YAML. A Read
 * fills the "radio" column and sets nothing; copying values from a radio into overrides is an
 * explicit action ({@link copyAllFromRead}).
 */

import { useSyncExternalStore } from 'react';
import {
  AT_D890_ADVANCED_SETTINGS_FIELD_IDS,
  AT_D890_ALL_SETTINGS_FIELD_IDS,
  AT_D890_V1_SETTINGS_FIELD_IDS,
} from '@core/radios/anytone/at-d890uv/radioSettings.ts';
import type {
  AtD890DecodedSetting,
  AtD890LanguageLock,
  AtD890SettingValue,
  AtD890SettingsOverride,
} from '@integrations/radio-io/radios/at-d890uv/index.ts';

// Backups saved this session live in the radio-neutral store; re-exported for the Review.
export { addBackupThisSession } from './radioSessionBackups.ts';

/** What a settings Read of one radio produced. */
export interface AtD890RadioSettingsRead {
  readonly serial: string;
  readonly masterIdName: string;
  readonly readAt: number;
  readonly bandCode: number;
  readonly languageLock: AtD890LanguageLock;
  readonly decoded: Readonly<Record<string, AtD890DecodedSetting>>;
}

/** The Write stepper's ticks, kept so an Edit round trip to the settings page returns to them. */
export interface AtD890StepperTicks {
  readonly codeplug: boolean;
  readonly contacts: boolean;
  readonly settings: boolean;
  readonly keps: boolean;
}

export interface AtD890RadioSettingsSessionState {
  readonly overrides: ReadonlyMap<string, AtD890SettingValue>;
  /**
   * "Show advanced settings" is on. Per tab, in memory only; turning it off drops the advanced
   * overrides, so nothing hidden is ever written.
   */
  readonly showAdvanced: boolean;
  readonly read?: AtD890RadioSettingsRead;
  /** The "don't ask again until reload" tick of the Done screen; read by the Review step. */
  readonly applyToEveryRadio: boolean;
  /** Ticks to restore when the stepper reopens after Edit; cleared once used. */
  readonly stepperTicks?: AtD890StepperTicks;
  /** "Write settings…" on the settings page asked the Export page to open the stepper with only Radio settings ticked. */
  readonly writeSettingsRequested: boolean;
}

const EMPTY: AtD890RadioSettingsSessionState = {
  overrides: new Map(),
  showAdvanced: false,
  applyToEveryRadio: false,
  writeSettingsRequested: false,
};

const states = new Map<string, AtD890RadioSettingsSessionState>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function update(
  buildId: string,
  fn: (s: AtD890RadioSettingsSessionState) => AtD890RadioSettingsSessionState,
): void {
  const next = fn(states.get(buildId) ?? EMPTY);
  states.set(buildId, next);
  emit();
}

export function subscribeAtD890RadioSettingsSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAtD890RadioSettingsSession(buildId: string): AtD890RadioSettingsSessionState {
  return states.get(buildId) ?? EMPTY;
}

export function setOverride(buildId: string, fieldId: string, value: AtD890SettingValue): void {
  update(buildId, (s) => ({ ...s, overrides: new Map(s.overrides).set(fieldId, value) }));
}

export function clearOverride(buildId: string, fieldId: string): void {
  update(buildId, (s) => {
    if (!s.overrides.has(fieldId)) return s;
    const overrides = new Map(s.overrides);
    overrides.delete(fieldId);
    return { ...s, overrides };
  });
}

const PASSWORD_ENABLED = 'powerOnPasswordEnabled';
const PASSWORD_DIGITS = 'powerOnPasswordDigits';

/**
 * The power-on password is one control over two fields: the two overrides are always set and
 * cleared together. Digits are validated by the caller (1 to 8 digits).
 */
export function setPowerOnPassword(buildId: string, digits: string): void {
  update(buildId, (s) => ({
    ...s,
    overrides: new Map(s.overrides).set(PASSWORD_ENABLED, true).set(PASSWORD_DIGITS, digits),
  }));
}

/** Turn the power-on password off: enable 0 and the eight bytes cleared. Needs no read. */
export function setPowerOnPasswordOff(buildId: string): void {
  update(buildId, (s) => ({
    ...s,
    overrides: new Map(s.overrides).set(PASSWORD_ENABLED, false).set(PASSWORD_DIGITS, ''),
  }));
}

/** Back to Keep for the power-on password. */
export function clearPowerOnPassword(buildId: string): void {
  update(buildId, (s) => {
    if (!s.overrides.has(PASSWORD_ENABLED) && !s.overrides.has(PASSWORD_DIGITS)) return s;
    const overrides = new Map(s.overrides);
    overrides.delete(PASSWORD_ENABLED);
    overrides.delete(PASSWORD_DIGITS);
    return { ...s, overrides };
  });
}

/** How many changes the overrides are: the two password fields count once. */
export function atD890OverrideCount(overrides: ReadonlyMap<string, unknown>): number {
  return overrides.has(PASSWORD_ENABLED) && overrides.has(PASSWORD_DIGITS)
    ? overrides.size - 1
    : overrides.size;
}

/** How many advanced overrides are set (the password pair counts once). */
export function advancedOverrideCount(overrides: ReadonlyMap<string, unknown>): number {
  const advanced = new Map([...overrides].filter(([id]) => ADVANCED_IDS.has(id)));
  return atD890OverrideCount(advanced);
}

const ADVANCED_IDS: ReadonlySet<string> = new Set(AT_D890_ADVANCED_SETTINGS_FIELD_IDS);

/**
 * Show or hide the advanced fields. Hiding drops every advanced override: a value the user can no
 * longer see must not be written.
 */
export function setShowAdvanced(buildId: string, on: boolean): void {
  update(buildId, (s) => {
    if (on) return s.showAdvanced ? s : { ...s, showAdvanced: true };
    const overrides = new Map([...s.overrides].filter(([id]) => !ADVANCED_IDS.has(id)));
    return { ...s, showAdvanced: false, overrides };
  });
}

export function clearAllOverrides(buildId: string): void {
  update(buildId, (s) => (s.overrides.size === 0 ? s : { ...s, overrides: new Map() }));
}

/** Keep what a radio holds. Does not change the overrides. */
export function setRead(buildId: string, read: AtD890RadioSettingsRead): void {
  update(buildId, (s) => ({ ...s, read }));
}

/**
 * Every v1 field the radio holds with a value Studio offers becomes an override. Fields with no
 * decoded value are left as they are. Never called automatically.
 */
export function copyAllFromRead(buildId: string): void {
  update(buildId, (s) => {
    if (!s.read) return s;
    const overrides = new Map(s.overrides);
    for (const id of AT_D890_V1_SETTINGS_FIELD_IDS) {
      const value = s.read.decoded[id]?.value;
      if (value !== undefined) overrides.set(id, value);
    }
    return { ...s, overrides };
  });
}

/** The overrides as upload input, in field display order. */
export function overridesForWrite(buildId: string): AtD890SettingsOverride[] {
  const { overrides } = getAtD890RadioSettingsSession(buildId);
  const known = new Set<string>(AT_D890_ALL_SETTINGS_FIELD_IDS);
  const ordered = AT_D890_ALL_SETTINGS_FIELD_IDS.filter((id) => overrides.has(id));
  const rest = [...overrides.keys()].filter((id) => !known.has(id));
  return [...ordered, ...rest].map((fieldId) => ({ fieldId, value: overrides.get(fieldId)! }));
}

export function setApplyToEveryRadio(buildId: string, value: boolean): void {
  update(buildId, (s) => (s.applyToEveryRadio === value ? s : { ...s, applyToEveryRadio: value }));
}

/** Whether the settings Review asks which to do for this radio: `apply` / `keep`. */
export type AtD890SettingsChoice = 'apply' | 'keep';

/**
 * The Review's preselected choice for the radio with this serial. The radio the settings were read
 * from, or any radio while "don't ask again" is set, preselects Apply; any other radio, or no read
 * this session, preselects Keep.
 */
export function defaultSettingsChoice(
  state: AtD890RadioSettingsSessionState,
  serial: string,
): AtD890SettingsChoice {
  if (state.applyToEveryRadio) return 'apply';
  return isSettingsReadRadio(state, serial) ? 'apply' : 'keep';
}

/**
 * True when the settings were read from the radio with this serial (no choice to make). A blank
 * serial (NUL or non-ASCII bytes in LocalInfo) identifies nothing, so it is never the same radio:
 * the user gets the fleet choice.
 */
export function isSettingsReadRadio(
  state: AtD890RadioSettingsSessionState,
  serial: string,
): boolean {
  if (serial.trim() === '' || state.read === undefined) return false;
  return state.read.serial === serial;
}

export function setWriteSettingsRequested(buildId: string, requested: boolean): void {
  update(buildId, (s) =>
    s.writeSettingsRequested === requested ? s : { ...s, writeSettingsRequested: requested },
  );
}

export function setStepperTicks(buildId: string, ticks: AtD890StepperTicks | undefined): void {
  update(buildId, (s) => ({ ...s, stepperTicks: ticks }));
}

/** React binding: the build's session state, re-rendered on change. */
export function useAtD890RadioSettingsSession(buildId: string): AtD890RadioSettingsSessionState {
  return useSyncExternalStore(
    subscribeAtD890RadioSettingsSession,
    () => getAtD890RadioSettingsSession(buildId),
    () => EMPTY,
  );
}
