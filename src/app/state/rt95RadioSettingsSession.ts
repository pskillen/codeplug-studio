/**
 * RT95 radio settings: per-build session state (#1476).
 *
 * Overrides and the values read from a radio live in memory until the page is refreshed. They are
 * never written to the build, IndexedDB, localStorage or YAML.
 */

import { useSyncExternalStore } from 'react';
import {
  RT95_ADVANCED_SETTINGS_FIELD_IDS,
  RT95_ALL_SETTINGS_FIELD_IDS,
  RT95_BASIC_SETTINGS_FIELD_IDS,
  RT95_POWER_ON_PASSWORD_FIELD_IDS,
} from '@core/radios/retevis/rt95/radioSettings.ts';
import type {
  Rt95SettingValue,
  Rt95SettingsOverride,
} from '@integrations/radio-io/radios/rt95/settingsFields.ts';
import type { Rt95RadioSettingsRead } from '../services/radioIoRt95SettingsRead.ts';

export interface Rt95RadioSettingsSessionState {
  readonly overrides: ReadonlyMap<string, Rt95SettingValue>;
  readonly showAdvanced: boolean;
  readonly read?: Rt95RadioSettingsRead;
  readonly writeSettingsRequested: boolean;
}

const EMPTY: Rt95RadioSettingsSessionState = {
  overrides: new Map(),
  showAdvanced: false,
  writeSettingsRequested: false,
};

const states = new Map<string, Rt95RadioSettingsSessionState>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function update(
  buildId: string,
  fn: (s: Rt95RadioSettingsSessionState) => Rt95RadioSettingsSessionState,
): void {
  const next = fn(states.get(buildId) ?? EMPTY);
  states.set(buildId, next);
  emit();
}

export function subscribeRt95RadioSettingsSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRt95RadioSettingsSession(buildId: string): Rt95RadioSettingsSessionState {
  return states.get(buildId) ?? EMPTY;
}

export function setOverride(buildId: string, fieldId: string, value: Rt95SettingValue): void {
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

const PASSWORD_ENABLED = RT95_POWER_ON_PASSWORD_FIELD_IDS[0]!;
const PASSWORD_DIGITS = RT95_POWER_ON_PASSWORD_FIELD_IDS[1]!;

export function setPowerOnPassword(buildId: string, digits: string): void {
  update(buildId, (s) => ({
    ...s,
    overrides: new Map(s.overrides).set(PASSWORD_ENABLED, true).set(PASSWORD_DIGITS, digits),
  }));
}

export function setPowerOnPasswordOff(buildId: string): void {
  update(buildId, (s) => ({
    ...s,
    overrides: new Map(s.overrides).set(PASSWORD_ENABLED, false).set(PASSWORD_DIGITS, ''),
  }));
}

export function clearPowerOnPassword(buildId: string): void {
  update(buildId, (s) => {
    if (!s.overrides.has(PASSWORD_ENABLED) && !s.overrides.has(PASSWORD_DIGITS)) return s;
    const overrides = new Map(s.overrides);
    overrides.delete(PASSWORD_ENABLED);
    overrides.delete(PASSWORD_DIGITS);
    return { ...s, overrides };
  });
}

export function rt95OverrideCount(overrides: ReadonlyMap<string, unknown>): number {
  return overrides.has(PASSWORD_ENABLED) && overrides.has(PASSWORD_DIGITS)
    ? overrides.size - 1
    : overrides.size;
}

export function advancedOverrideCount(overrides: ReadonlyMap<string, unknown>): number {
  const advanced = new Map([...overrides].filter(([id]) => ADVANCED_IDS.has(id)));
  return rt95OverrideCount(advanced);
}

const ADVANCED_IDS: ReadonlySet<string> = new Set(RT95_ADVANCED_SETTINGS_FIELD_IDS);

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

export function setRead(buildId: string, read: Rt95RadioSettingsRead): void {
  update(buildId, (s) => ({ ...s, read }));
}

export function copyAllFromRead(buildId: string): void {
  update(buildId, (s) => {
    if (!s.read) return s;
    const overrides = new Map(s.overrides);
    for (const id of RT95_BASIC_SETTINGS_FIELD_IDS) {
      const value = s.read.decoded[id]?.value;
      if (value !== undefined) overrides.set(id, value);
    }
    return { ...s, overrides };
  });
}

export function overridesForWrite(buildId: string): Rt95SettingsOverride[] {
  const { overrides } = getRt95RadioSettingsSession(buildId);
  const known = new Set<string>(RT95_ALL_SETTINGS_FIELD_IDS);
  const ordered = RT95_ALL_SETTINGS_FIELD_IDS.filter((id) => overrides.has(id));
  const rest = [...overrides.keys()].filter((id) => !known.has(id));
  return [...ordered, ...rest].map((fieldId) => ({ fieldId, value: overrides.get(fieldId)! }));
}

export function setWriteSettingsRequested(buildId: string, requested: boolean): void {
  update(buildId, (s) =>
    s.writeSettingsRequested === requested ? s : { ...s, writeSettingsRequested: requested },
  );
}

export function useRt95RadioSettingsSession(buildId: string): Rt95RadioSettingsSessionState {
  return useSyncExternalStore(
    subscribeRt95RadioSettingsSession,
    () => getRt95RadioSettingsSession(buildId),
    () => EMPTY,
  );
}
