/**
 * Test and styleguide helpers: a default stepper config, view and (no-op or spy) actions.
 * Not used by product code.
 */

import { DEFAULT_WRITE_PARTS } from './writeParts.ts';
import type { WriteFlowActions, WriteFlowView, WriteStepperConfig } from './types.ts';

export function demoStepperConfig(overrides: Partial<WriteStepperConfig> = {}): WriteStepperConfig {
  return {
    radioLabel: 'AT-D890UV',
    buildId: 'build-1',
    serialOk: true,
    writeHidden: false,
    support: { contacts: true, keps: true, settings: false },
    sharedContactBankNote: false,
    sharedAddressBookNote: false,
    restartWaitSeconds: 20,
    supportsCheck: true,
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
    error: null,
    canReconnect: false,
    reconnecting: false,
    progress: null,
    readRows: [],
    writeRows: [],
    identity: null,
    review: null,
    restartSecondsLeft: 0,
    checkStatus: 'none',
    kepsAfterRestart: 'none',
    summary: null,
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
    onReconnect: make(),
    onCheckWrite: make(),
    onSkipCheck: make(),
    onWriteKepsAfterRestart: make(),
    onWriteAnother: make(),
    onViewCheckReport: make(),
  };
}
