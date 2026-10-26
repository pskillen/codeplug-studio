/**
 * Live state of one AT-D890UV Review (#1393): the settings choice, and the backup button. A tiny
 * external store so the section components, created once when Review opens, stay current without
 * the stepper's view-model carrying D890 fields. One controller per Review.
 */

import type { AtD890SettingsChoice } from '../../../../state/atD890RadioSettingsSession.ts';
import type { AtD890SettingsTargetId } from '@core/radios/anytone/at-d890uv/radioSettings.ts';
import type {
  AtD890DecodedSetting,
  AtD890RadioSettingsSnapshot,
} from '@integrations/radio-io/radios/at-d890uv/index.ts';
import type { AtD890ReceiveOnlyChannel } from './atD890ReviewFacts.ts';
import type { AtD890FrequencyRangeDescription } from '@core/radios/anytone/at-d890uv/frequencyRange.ts';

export type AtD890BackupStatus =
  | { status: 'none' }
  | { status: 'reading' }
  | { status: 'saving' }
  | { status: 'saved'; at: number }
  | { status: 'error'; message: string };

export interface AtD890ReviewState {
  choice: AtD890SettingsChoice;
  backup: AtD890BackupStatus;
  /** Radio settings is ticked (the step-key nudge can tick it while Review is open). */
  settingsTicked: boolean;
}

/** Fixed facts about this Review, plus the actions its buttons call. */
export interface AtD890ReviewInit {
  buildId: string;
  serial: string;
  masterIdName: string;
  range: AtD890FrequencyRangeDescription;
  receiveOnly: AtD890ReceiveOnlyChannel[];
  snapshot: Pick<AtD890RadioSettingsSnapshot, 'main' | 'ext'>;
  target: AtD890SettingsTargetId;
  /** The radio's settings, decoded from the snapshot. */
  decoded: Readonly<Record<string, AtD890DecodedSetting>>;
  initialSettingsTicked: boolean;
  /** The settings were read from this radio: no choice to make. */
  sameRadio: boolean;
  /** "Don't ask again" is set: the preselected Apply says so. */
  applyToEveryRadio: boolean;
  /** The only ticked part is Radio settings. */
  settingsOnly: boolean;
  /** The Write's read covers a full backup (a codeplug Write); otherwise a read is needed first. */
  fullReadHeld: boolean;
  /** Seconds the extra read would take (settings-only), for the button. */
  readRestSeconds: number | null;
  initialChoice: AtD890SettingsChoice;
  initialBackup: AtD890BackupStatus;
  onSaveBackup: () => void;
  onReviewSettings: () => void;
  /** The nudge's button: set the two step-key overrides and tick Radio settings. */
  onUseStepKeys: () => void;
}

export interface AtD890ReviewController {
  readonly init: AtD890ReviewInit;
  getState(): AtD890ReviewState;
  subscribe(listener: () => void): () => void;
  setChoice(choice: AtD890SettingsChoice): void;
  setBackup(backup: AtD890BackupStatus): void;
  setSettingsTicked(ticked: boolean): void;
  /** Whether pressing Write would write anything (settings alone with Keep writes nothing). */
  canWrite(): boolean;
}

export function createAtD890ReviewController(init: AtD890ReviewInit): AtD890ReviewController {
  let state: AtD890ReviewState = {
    choice: init.initialChoice,
    backup: init.initialBackup,
    settingsTicked: init.initialSettingsTicked,
  };
  const listeners = new Set<() => void>();
  const set = (next: AtD890ReviewState) => {
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
    canWrite: () => !(init.settingsOnly && state.settingsTicked && state.choice === 'keep'),
  };
}
