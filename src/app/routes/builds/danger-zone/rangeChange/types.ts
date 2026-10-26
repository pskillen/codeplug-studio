/**
 * View and action types of the Change frequency range wizard. `useRangeChangeFlow` owns the state machine and the
 * services; the step components in `steps/` only render a `view` and call `actions`.
 */

import type { AtD890RangeChangeTarget } from '@core/radios/anytone/at-d890uv/frequencyRange.ts';
import type { RangeChangeJournalEntry } from '@integrations/persistence/rangeChangeJournal.ts';
import type { ProgressUpdate } from '@integrations/radio-io/types.ts';
import type { StageRow } from '../../../../components/builds/RadioIoStageList.tsx';
import type { RestoreCheckResult } from '../../../../services/dangerZone/atD890RestoreCheck.ts';
import type { RangeChangeRadio } from '../../../../services/dangerZone/atD890RangeChangeService.ts';

export type RangeChangeStep =
  | 'read'
  | 'newRange'
  | 'backUp'
  | 'confirm'
  | 'change'
  | 'restart'
  | 'restore'
  | 'check'
  | 'done'
  | 'resume';

/** The eight numbered steps (Done and Resume are not numbered). */
export const RANGE_CHANGE_STEPS = [
  'read',
  'newRange',
  'backUp',
  'confirm',
  'change',
  'restart',
  'restore',
  'check',
] as const;

export type NoticeTone = 'refusal' | 'warning' | 'info' | 'success';

export type NoticeKind =
  | 'not-d890'
  | 'stun-kill'
  | 'connect-failed'
  | 'unfinished'
  | 'backup-failed'
  | 'backup-refused'
  | 'radio-changed'
  | 'change-refused'
  | 'not-taken'
  | 'unreadable'
  | 'unknown'
  | 'no-port'
  | 'wrong-radio'
  | 'still-old'
  | 'unexpected-range'
  | 'identity-differs'
  | 'restore-failed'
  | 'check-differs'
  | 'check-failed'
  | 'resume-wrong-file'
  | 'resume-wrong-serial'
  | 'resume-bad-file'
  | 'resume-same-range'
  | 'resume-nothing-changed';

export interface RangeChangeNotice {
  kind: NoticeKind;
  tone: NoticeTone;
  title?: string;
  body: string;
  /** Said at the end of an exit before the frame. */
  nothingChanged?: boolean;
  /** Technical details the user can copy. */
  details?: string;
}

/** A row of the new-range list. */
export interface RangeChangeTargetRow {
  code: number;
  caption: string;
  current: boolean;
  /** Selectable. Code 14 is not without `890#`; the current range is never. */
  selectable: boolean;
  disabledReason?: string;
  unlisted: boolean;
  /** "Transmit 144–148, 420–450 MHz (was 144–146, 430–440)" or the current range's own line. */
  transmitLine: string;
  receiveLine: string;
  direction?: 'wider' | 'narrower' | 'different';
  uhfOff: boolean;
  narrowReceive: boolean;
  raw: AtD890RangeChangeTarget;
}

export interface RangeChangeChecklistItem {
  id: string;
  text: string;
  ok: boolean;
}

export interface RangeChangeResumeView {
  /** Journal record this resume is for, when there is one. */
  entry: RangeChangeJournalEntry | null;
  /** More than one unfinished record: the user chooses. */
  choices: readonly RangeChangeJournalEntry[];
  fileName: string | null;
  fileOk: boolean;
  vitalName: string | null;
  /** Where Resume goes next: connect (sending, changed or no journal) or straight to Check (restored). */
  next: 'connect' | 'check' | null;
}

export interface RangeChangeView {
  step: RangeChangeStep;
  /** A transfer or session is running: the page keeps the screen awake and asks before leaving. */
  busy: boolean;
  /** The radio is wiped (or may be) until Restore finishes. */
  wiped: boolean;
  progress: ProgressUpdate | null;
  notice: RangeChangeNotice | null;
  supported: boolean;

  radio: RangeChangeRadio | null;
  rangeRows: readonly RangeChangeTargetRow[];
  target: number | null;
  currentCode: number | null;
  /** The sanitised current range is not one the CPS offers. */
  currentUnlisted: boolean;
  /** Stored raw code differs from the sanitised one. */
  rawCodeNote: string | null;

  backUp: {
    phase: 'idle' | 'running' | 'saved';
    rows: readonly StageRow[];
    backupName: string | null;
    vitalName: string | null;
    savedTick: boolean;
    summary: string | null;
  };
  confirm: {
    ticked: boolean;
    receiveOnly: { count: number; total: number } | null;
    opens: string | null;
  };
  restart: {
    secondsLeft: number;
    totalSeconds: number;
    canReconnect: boolean;
    checklist: readonly RangeChangeChecklistItem[];
    /** The radio is verified and Restore may start. */
    verified: boolean;
    anywayOpen: boolean;
    anywayAvailable: boolean;
  };
  restore: { rows: readonly StageRow[]; failed: boolean; backupTime: string | null };
  check: {
    secondsLeft: number;
    totalSeconds: number;
    rows: readonly StageRow[];
    result: RestoreCheckResult | null;
  };
  done: { skipped: boolean; changeBackCode: number | null };
  resume: RangeChangeResumeView;

  fromCode: number | null;
  toCode: number | null;
  /** Leave guard. */
  leaveOpen: boolean;
}

export interface RangeChangeActions {
  onConnectRead: () => void;
  onReadNext: () => void;
  onPickTarget: (code: number) => void;
  onRangeNext: () => void;
  onBackUp: () => void;
  onSaveAgain: () => void;
  onSavedTick: (ticked: boolean) => void;
  onBackUpNext: () => void;
  onConfirmTick: (ticked: boolean) => void;
  onChange: () => void;
  /** Any exit before the frame: closes the session and leaves. Nothing has changed. */
  onCancel: () => void;
  onStartAgain: () => void;
  onReconnect: (forcePicker: boolean) => void;
  onRestore: () => void;
  onRestoreAnywayOpen: () => void;
  onRestoreAnywayClose: () => void;
  onRestoreAnywayConfirm: () => void;
  onRestoreAgain: () => void;
  onCheck: () => void;
  onSkipCheck: () => void;
  onFinish: () => void;
  onBackToExport: () => void;
  onChangeBack: () => void;
  onCopyDetails: () => void;
  onChooseResume: (serial: string) => void;
  onResumeFile: (file: File | null) => void;
  onResumeVital: (file: File | null) => void;
  onResumeConnect: () => void;
  onResumeToCheck: () => void;
  onResumeFromNotice: (serial: string) => void;
  onLeaveStay: () => void;
  onLeaveConfirm: () => void;
}
