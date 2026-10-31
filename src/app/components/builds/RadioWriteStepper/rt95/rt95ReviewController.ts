/**
 * Live state for one RT95 Review (#1476): fleet choice for settings, backup reminder.
 */

import type {
  Rt95RadioSettingsSnapshot,
  Rt95SettingsOverride,
  Rt95SettingsTarget,
} from '@integrations/radio-io/radios/rt95/settingsFields.ts';

export type Rt95SettingsChoice = 'apply' | 'keep';

export type Rt95BackupStatus = { status: 'none' } | { status: 'saved'; at: number };

export interface Rt95ReviewState {
  choice: Rt95SettingsChoice;
  backup: Rt95BackupStatus;
  settingsTicked: boolean;
}

export interface Rt95ReviewInit {
  buildId: string;
  /** RT95 ident has no serial; band limit from the read is shown instead. */
  bandlimit: number;
  snapshot: Rt95RadioSettingsSnapshot;
  target: Rt95SettingsTarget;
  getOverrides: () => readonly Rt95SettingsOverride[];
  initialSettingsTicked: boolean;
  /** The settings page read used the same band-limit code as this radio. */
  sameRadio: boolean;
  settingsOnly: boolean;
  initialChoice: Rt95SettingsChoice;
  initialBackup: Rt95BackupStatus;
  onReviewSettings: () => void;
}

export interface Rt95ReviewController {
  readonly init: Rt95ReviewInit;
  getState(): Rt95ReviewState;
  subscribe(listener: () => void): () => void;
  setChoice(choice: Rt95SettingsChoice): void;
  setBackup(backup: Rt95BackupStatus): void;
  setSettingsTicked(ticked: boolean): void;
  canWrite(): boolean;
  refresh(): void;
}

export function createRt95ReviewController(init: Rt95ReviewInit): Rt95ReviewController {
  let state: Rt95ReviewState = {
    choice: init.initialChoice,
    backup: init.initialBackup,
    settingsTicked: init.initialSettingsTicked,
  };
  const listeners = new Set<() => void>();
  const set = (next: Rt95ReviewState) => {
    state = next;
    for (const l of listeners) l();
  };
  return {
    init,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setChoice: (choice) => set({ ...state, choice }),
    setBackup: (backup) => set({ ...state, backup }),
    setSettingsTicked: (settingsTicked) => set({ ...state, settingsTicked }),
    refresh: () => set({ ...state }),
    canWrite: () =>
      !(init.settingsOnly && state.settingsTicked && state.choice === 'keep') &&
      !(
        init.settingsOnly &&
        state.settingsTicked &&
        state.choice === 'apply' &&
        init.getOverrides().length === 0
      ),
  };
}

/** Default fleet choice: apply when the page read matches this radio's band limit. */
export function defaultRt95SettingsChoice(
  readBandlimit: number | undefined,
  radioBandlimit: number,
): Rt95SettingsChoice {
  if (readBandlimit === undefined) return 'keep';
  return readBandlimit === radioBandlimit ? 'apply' : 'keep';
}

export function isRt95SettingsReadRadio(
  readBandlimit: number | undefined,
  radioBandlimit: number,
): boolean {
  return readBandlimit !== undefined && readBandlimit === radioBandlimit;
}
