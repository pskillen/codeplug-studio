import type { Dispatch } from 'react';

import type { FirmwareUpdaterDescriptor } from '@integrations/radio-io';

import type { FirmwareWizardAction, FirmwareWizardState } from '../firmwareWizardState.ts';

export interface WizardStepProps {
  readonly state: FirmwareWizardState;
  readonly dispatch: Dispatch<FirmwareWizardAction>;
  /** The chosen radio's updater; set from the Firmware step on. */
  readonly updater: FirmwareUpdaterDescriptor;
}

/** First 12 hex characters, for display. */
export function shortHash(sha256: string): string {
  return sha256.slice(0, 12);
}
