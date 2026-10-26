/**
 * Backups saved this session, for every Web Serial radio (#1393).
 *
 * A backup saved from the Backup page or from the Write's Review is listed here with the radio's
 * name, serial and time. Names and serials stay in this tab's memory only: no localStorage,
 * IndexedDB or project state, so a reload clears the list.
 */

import { useSyncExternalStore } from 'react';

/**
 * One backup saved this session. `model` is the radio model label and is always set. `name` is the
 * radio's own name and is empty when unknown. `serial` is empty when the radio reports none.
 */
export interface RadioBackupThisSession {
  readonly serial: string;
  readonly model: string;
  readonly name: string;
  readonly at: number;
}

/** How an entry reads everywhere: the name with the model beneath, or the model alone. */
export function describeBackupRadio(b: RadioBackupThisSession): {
  primary: string;
  secondary: string | null;
} {
  const name = b.name.trim();
  const model = b.model.trim() || 'radio';
  return name ? { primary: name, secondary: model } : { primary: model, secondary: null };
}

/**
 * The newest backup saved from the radio with this serial. A blank serial never matches: Studio
 * cannot tell two such radios apart.
 */
export function findBackupForSerial(
  buildId: string,
  serial: string,
): RadioBackupThisSession | undefined {
  if (serial.trim() === '') return undefined;
  return getBackupsThisSession(buildId)
    .filter((b) => b.serial === serial)
    .at(-1);
}

const EMPTY: readonly RadioBackupThisSession[] = [];
const byBuild = new Map<string, readonly RadioBackupThisSession[]>();
const listeners = new Set<() => void>();

export function subscribeBackupsThisSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The build's backups this session, oldest first. */
export function getBackupsThisSession(buildId: string): readonly RadioBackupThisSession[] {
  return byBuild.get(buildId) ?? EMPTY;
}

export function addBackupThisSession(buildId: string, backup: RadioBackupThisSession): void {
  byBuild.set(buildId, [...getBackupsThisSession(buildId), backup]);
  for (const l of listeners) l();
}

/** Tests only: forget every recorded backup. */
export function resetBackupsThisSession(): void {
  byBuild.clear();
  for (const l of listeners) l();
}

/** React binding: the build's backups this session, oldest first. */
export function useBackupsThisSession(buildId: string): readonly RadioBackupThisSession[] {
  return useSyncExternalStore(
    subscribeBackupsThisSession,
    () => getBackupsThisSession(buildId),
    () => EMPTY,
  );
}
