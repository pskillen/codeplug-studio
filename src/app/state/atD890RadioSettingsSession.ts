/**
 * AT-D890UV radio settings: per-build session state (#1393).
 *
 * Overrides, and the values read from a radio, live in memory until the page is refreshed. They are
 * never written to the build, `RadioBuild.exportSettings`, IndexedDB, localStorage or YAML. A Read
 * fills the "radio" column and sets nothing; copying values from a radio into overrides is an
 * explicit action ({@link copyAllFromRead}).
 */

import { useSyncExternalStore } from 'react';
import { AT_D890_V1_SETTINGS_FIELD_IDS } from '@core/radios/anytone/at-d890uv/radioSettings.ts';
import type {
  AtD890DecodedSetting,
  AtD890LanguageLock,
  AtD890SettingValue,
  AtD890SettingsOverride,
} from '@integrations/radio-io/radios/at-d890uv/index.ts';

/** What a settings Read of one radio produced. */
export interface AtD890RadioSettingsRead {
  readonly serial: string;
  readonly masterIdName: string;
  readonly readAt: number;
  readonly bandCode: number;
  readonly languageLock: AtD890LanguageLock;
  readonly decoded: Readonly<Record<string, AtD890DecodedSetting>>;
}

export interface AtD890RadioSettingsSessionState {
  readonly overrides: ReadonlyMap<string, AtD890SettingValue>;
  readonly read?: AtD890RadioSettingsRead;
  /** The "don't ask again until reload" tick of the Done screen; read by the Review step (PR 4c). */
  readonly applyToEveryRadio: boolean;
}

const EMPTY: AtD890RadioSettingsSessionState = {
  overrides: new Map(),
  applyToEveryRadio: false,
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
  const known = new Set<string>(AT_D890_V1_SETTINGS_FIELD_IDS);
  const ordered = AT_D890_V1_SETTINGS_FIELD_IDS.filter((id) => overrides.has(id));
  const rest = [...overrides.keys()].filter((id) => !known.has(id));
  return [...ordered, ...rest].map((fieldId) => ({ fieldId, value: overrides.get(fieldId)! }));
}

export function setApplyToEveryRadio(buildId: string, value: boolean): void {
  update(buildId, (s) => (s.applyToEveryRadio === value ? s : { ...s, applyToEveryRadio: value }));
}

/** React binding: the build's session state, re-rendered on change. */
export function useAtD890RadioSettingsSession(buildId: string): AtD890RadioSettingsSessionState {
  return useSyncExternalStore(
    subscribeAtD890RadioSettingsSession,
    () => getAtD890RadioSettingsSession(buildId),
    () => EMPTY,
  );
}
