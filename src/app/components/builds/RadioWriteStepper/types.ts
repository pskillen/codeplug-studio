/**
 * Shared shapes for the Write stepper (#1393): the step machine and the view-model that
 * `useRadioWriteFlow` produces and `RadioWriteStepper` renders.
 */

import type { ReactNode } from 'react';
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import type { DigitalContactsWriteSource } from '@core/domain/digitalIdDirectoryProjection.ts';
import type { ProgressUpdate } from '@integrations/radio-io/types.ts';
import type { WriteVerifyResult } from '@integrations/radio-io/writeVerify.ts';
import type { SatelliteKepsWriteResult } from '../../../services/satelliteKepsWriteAdapters.ts';
import type { WriteParts, WritePartSupport } from './writeParts.ts';

export type WriteStep =
  'whatToWrite' | 'connectRead' | 'review' | 'writing' | 'restartCheck' | 'done';

export const WRITE_STEPS: readonly WriteStep[] = [
  'whatToWrite',
  'connectRead',
  'review',
  'writing',
  'restartCheck',
  'done',
];

export const WRITE_STEP_LABEL: Record<WriteStep, string> = {
  whatToWrite: 'What to write',
  connectRead: 'Read',
  review: 'Review',
  writing: 'Writing',
  restartCheck: 'Restart & check',
  done: 'Done',
};

/** "2 of 6 · Read". */
export function stepBarLabel(step: WriteStep): string {
  return `${WRITE_STEPS.indexOf(step) + 1} of ${WRITE_STEPS.length} · ${WRITE_STEP_LABEL[step]}`;
}

/** What Studio knows about the connected radio. Serial is shown in full. */
export interface RadioIdentityView {
  model: string;
  serial?: string;
  name?: string;
  firmware?: string;
}

export type CheckStatus = 'none' | 'available' | 'running' | 'passed' | 'failed' | 'skipped';

/** Static facts about the radio and build that the part list needs. */
export interface WriteStepperConfig {
  radioLabel: string;
  buildId: string;
  serialOk: boolean;
  writeHidden: boolean;
  support: WritePartSupport;
  /** Contacts: shared-bank notes (OpenGD77, DM-32). */
  sharedContactBankNote: boolean;
  sharedAddressBookNote: boolean;
  /** Part summaries. */
  codeplugSummary?: string;
  kepsSummary?: string;
  kepsLastUpdatedIso?: string | null;
  channelLocationNote?: string | null;
  /** MM9PDY step-key switch (DM-32 only; the AT-D890 has the Review nudge instead). */
  stepKeys?: {
    checked: boolean;
    description: string;
    onChange: (checked: boolean) => void;
  };
  /** Seconds the radio needs to restart after END (0 when it does not need a wait). */
  restartWaitSeconds: number;
  /** Closing the session (Cancel on Review) sends END and the radio restarts (Q-C). */
  cancelRestartsRadio?: boolean;
  /** AT-D890 Radio settings part and Done-screen choice. Absent on every other radio. */
  radioSettings?: {
    /** Fields set this session. */
    count: number;
    /** The first few changes in words. */
    words: string[];
    /** "Don't ask again for other radios until I reload" (the Done screen's tick). */
    applyToEveryRadio: boolean;
    onApplyToEveryRadioChange: (checked: boolean) => void;
  };
  /** Radios with a Check write step. */
  supportsCheck: boolean;
  /** Extra sentence on the Done step (DM-32: power-cycle the radio). */
  successNote?: string;
}

export interface WriteStageRow {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'success' | 'error';
  weight?: number;
  optional?: boolean;
  /** One event per stage (D890 download): no in-stage fraction until the stage completes. */
  coarse?: boolean;
  /** Held in-stage fraction from the stage cursor (0..1). */
  fraction?: number;
}

export interface WriteSummary {
  codeplugWritten: boolean;
  contactsWritten: boolean;
  /** Radio settings applied to this radio: how many fields changed; null when none were applied. */
  settingsChanged: number | null;
  /** Radio settings was ticked. */
  settingsTicked: boolean;
  channelCount: number;
  kepsResult: SatelliteKepsWriteResult | null;
  /** Keps were ticked (so "not written" is worth saying when `kepsResult` is null). */
  kepsTicked: boolean;
  /** Why the keps part failed or stopped after the codeplug went onto the radio (D890). */
  kepsError: string | null;
  warnings: ExportWarning[];
  checkStatus: CheckStatus;
  checkResult: WriteVerifyResult | null;
  identity: RadioIdentityView | null;
  /** Per-stage write timings as one line of text to paste into a report; null when the radio has none. */
  writeTimings: string | null;
}

export interface WriteReviewView {
  channelCount: number;
  contactsNote: string | null;
  kepsCount: number | null;
  estimateSeconds: number | null;
  /** Studio reads the rest while writing (radios whose read happens inside upload). */
  identityOnly: boolean;
  /** Per-radio sections from `reviewSectionsFor` (the D890's included). */
  sections: ReactNode[];
  /** A Review that would write nothing (Radio settings alone with Keep): Write is disabled. */
  writeDisabled?: boolean;
  /**
   * The parts the Write will actually send, when that differs from the ticked ones (the D890 with
   * Keep chosen sends no settings). The primary button's label follows it.
   */
  effectiveParts?: WriteParts;
}

/** Everything the stepper renders. `useRadioWriteFlow` is the one producer. */
export interface WriteFlowView {
  open: boolean;
  step: WriteStep;
  parts: WriteParts;
  contactSource: Exclude<DigitalContactsWriteSource, 'none'>;
  /** A read or transfer is in flight (abort is possible, leaving is blocked). */
  busy: boolean;
  error: string | null;
  /** Offer "Reconnect and read again" with the error. */
  canReconnect: boolean;
  /** "Reconnecting: the radio may have left programming mode". */
  reconnecting: boolean;
  progress: ProgressUpdate | null;
  /** Rows for the Read step (empty when the radio declares no read plan). */
  readRows: WriteStageRow[];
  /** Rows for the Writing step. */
  writeRows: WriteStageRow[];
  identity: RadioIdentityView | null;
  review: WriteReviewView | null;
  /** Restart & check. */
  restartSecondsLeft: number;
  checkStatus: CheckStatus;
  kepsAfterRestart: 'none' | 'pending' | 'running' | 'done';
  /** Keps failed or were aborted after the codeplug was written in the same session. */
  kepsFailure: string | null;
  summary: WriteSummary | null;
}

export interface WriteFlowActions {
  onClose: () => void;
  onPartsChange: (parts: WriteParts) => void;
  onContactSourceChange: (source: Exclude<DigitalContactsWriteSource, 'none'>) => void;
  onConnectAndRead: () => void;
  /** Abort the current read or transfer. */
  onAbort: () => void;
  onWrite: () => void;
  /** Review → Cancel: nothing is written. */
  onCancelReview: () => void;
  onReconnect: () => void;
  onCheckWrite: () => void;
  onSkipCheck: () => void;
  onWriteKepsAfterRestart: () => void;
  onWriteAnother: () => void;
  onViewCheckReport: () => void;
  /** AT-D890 Radio settings part: Edit on the part row (the ticks are kept). */
  onEditSettings: () => void;
}
