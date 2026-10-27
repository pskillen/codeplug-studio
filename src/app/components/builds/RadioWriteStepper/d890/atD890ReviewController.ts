/**
 * Live state of one AT-D890UV Review (#1393): the settings choice, and the backup button. A tiny
 * external store so the section components, created once when Review opens, stay current without
 * the stepper's view-model carrying D890 fields. One controller per Review.
 */

import { atD890LanguageLockProblem } from '@integrations/radio-io/radios/at-d890uv/index.ts';
import type { AtD890SettingsChoice } from '../../../../state/atD890RadioSettingsSession.ts';
import type { AtD890SettingsTargetId } from '@core/radios/anytone/at-d890uv/radioSettings.ts';
import type {
  AtD890DecodedSetting,
  AtD890LanguageLock,
  AtD890RadioSettingsSnapshot,
  AtD890SettingsOverride,
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
  /**
   * The radio's "Master Id" flag (`MasterIdData` `+0x26`, `0x03684026`) is set in the image Studio
   * read: the radio then sends the master ID on every channel, so per-channel IDs have no effect.
   */
  masterIdSelected?: boolean;
  range: AtD890FrequencyRangeDescription;
  receiveOnly: AtD890ReceiveOnlyChannel[];
  snapshot: Pick<AtD890RadioSettingsSnapshot, 'main' | 'ext'>;
  target: AtD890SettingsTargetId;
  /** The radio's settings, decoded from the snapshot. */
  decoded: Readonly<Record<string, AtD890DecodedSetting>>;
  /** This radio's language lock, from LocalInfo `+0x04`. */
  languageLock: AtD890LanguageLock;
  /** The session overrides as they stand now (they can change while Review is open). */
  getOverrides: () => readonly AtD890SettingsOverride[];
  /** Drop the Language override (the Review's way out of a forbidden language). */
  onClearLanguage: () => void;
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
  /** Whether pressing Write would write anything (settings alone with Keep, or with no override left, writes nothing). */
  canWrite(): boolean;
  /**
   * Why the settings that would be applied cannot be written to this radio (a language its
   * region forbids), or `undefined`. Only while Radio settings is ticked and the choice is Apply.
   */
  blockReason(): string | undefined;
  /** Tell listeners to re-read (the overrides changed under the Review). */
  refresh(): void;
}

export function createAtD890ReviewController(init: AtD890ReviewInit): AtD890ReviewController {
  let state: AtD890ReviewState = {
    choice: init.initialChoice,
    backup: init.initialBackup,
    settingsTicked: init.initialSettingsTicked,
  };
  const listeners = new Set<() => void>();
  const blockReason = () =>
    state.settingsTicked && state.choice === 'apply'
      ? atD890LanguageLockProblem(init.getOverrides(), init.languageLock)
      : undefined;
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
    refresh: () => set({ ...state }),
    blockReason,
    canWrite: () =>
      !(init.settingsOnly && state.settingsTicked && state.choice === 'keep') &&
      // Settings alone with no override left (e.g. after clearing the language) sends nothing.
      !(
        init.settingsOnly &&
        state.settingsTicked &&
        state.choice === 'apply' &&
        init.getOverrides().length === 0
      ) &&
      blockReason() === undefined,
  };
}
