/**
 * Demo data for the styleguide and tests: a default stepper config, view and (no-op or spy) actions.
 * Product code never imports this.
 */

import { DEFAULT_WRITE_PARTS } from './writeParts.ts';
import type { WriteFlowActions, WriteFlowView, WriteStepperConfig } from './types.ts';
import type { WriteShellOptions } from '../../../services/egress/writeShellOptions.ts';

export function demoShellOptions(overrides: Partial<WriteShellOptions> = {}): WriteShellOptions {
  return {
    radioLabel: 'AT-D890UV',
    parts: { contacts: true, keps: true, settings: false },
    contactStore: 'separate-lookup-database',
    readPlan: true,
    programHoldSafeMs: Number.POSITIVE_INFINITY,
    restartAfterEndSeconds: 20,
    check: {
      available: true,
      reportLabels: {
        keptSectionTitle: 'Preserved settings',
        keptSummaryLabel: '6 sentinel regions',
      },
    },
    ...overrides,
  };
}

export function demoStepperConfig(overrides: Partial<WriteStepperConfig> = {}): WriteStepperConfig {
  return {
    radioLabel: 'AT-D890UV',
    buildId: 'build-1',
    serialOk: true,
    writeHidden: false,
    options: demoShellOptions(),
    ...overrides,
  };
}

export function demoFlowView(overrides: Partial<WriteFlowView> = {}): WriteFlowView {
  return {
    open: true,
    step: 'whatToWrite',
    parts: { ...DEFAULT_WRITE_PARTS },
    contactSource: 'library',
    busy: false,
    errorOutcome: null,
    retryLabel: null,
    notice: null,
    pendingWarning: null,
    reconnecting: false,
    progress: null,
    readStartedAt: null,
    writeStartedAt: null,
    checkStartedAt: null,
    readRows: [],
    writeRows: [],
    identity: null,
    review: null,
    reviewDecision: 'undecided',
    restartSecondsLeft: 0,
    checkStatus: 'none',
    kepsAfterRestart: 'none',
    kepsFailure: null,
    summary: null,
    buildChecks: { status: 'idle', warnings: [] },
    channelLabel: undefined,
    ...overrides,
  };
}

export function noopActions(make: () => () => void = () => () => {}): WriteFlowActions {
  return {
    onClose: make(),
    onPartsChange: make() as WriteFlowActions['onPartsChange'],
    onContactSourceChange: make() as WriteFlowActions['onContactSourceChange'],
    onConnectAndRead: make(),
    onAbort: make(),
    onWrite: make(),
    onCancelReview: make(),
    onRetry: make(),
    onChangeTicks: make(),
    onClearPendingWarning: make(),
    onCheckWrite: make(),
    onSkipCheck: make(),
    onWriteKepsAfterRestart: make(),
    onWriteAnother: make(),
    onViewCheckReport: make(),
    onEditSettings: make(),
  };
}
