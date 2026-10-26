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

/** What Studio knows about the connected radio. Serial is shown masked (last 4). */
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
  /** MM9PDY step-key switch (D890: removed in PR 4c; DM-32 keeps it). */
  stepKeys?: {
    checked: boolean;
    description: string;
    onChange: (checked: boolean) => void;
  };
  /** Seconds the radio needs to restart after END (0 when it does not need a wait). */
  restartWaitSeconds: number;
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
}

export interface WriteSummary {
  codeplugWritten: boolean;
  contactsWritten: boolean;
  channelCount: number;
  kepsResult: SatelliteKepsWriteResult | null;
  warnings: ExportWarning[];
  checkStatus: CheckStatus;
  checkResult: WriteVerifyResult | null;
  identity: RadioIdentityView | null;
}

export interface WriteReviewView {
  channelCount: number;
  contactsNote: string | null;
  kepsCount: number | null;
  estimateSeconds: number | null;
  /** Studio reads the rest while writing (radios whose read happens inside upload). */
  identityOnly: boolean;
  /** Per-radio sections from `reviewSectionsFor` (PR 4c adds the D890's). */
  sections: ReactNode[];
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
  startedAt?: number;
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
}
