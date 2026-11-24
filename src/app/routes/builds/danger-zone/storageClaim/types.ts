import type { StorageClaimLayout } from '@core/radios/radiofoundry/storageClaim.ts';
import type { StorageClaimCheckResult } from '@integrations/radio-io/radios/radiofoundry/storageClaim/index.ts';

export type StorageClaimStep = 'check' | 'backup' | 'confirm' | 'unlock' | 'done';

export interface StorageClaimView {
  step: StorageClaimStep;
  busy: boolean;
  notice: string | null;
  check: StorageClaimCheckResult | null;
  tokenHex: string | null;
  backupFileName: string | null;
  backupSaved: boolean;
  confirmTick: boolean;
  pollPending: boolean;
  layout: StorageClaimLayout | null;
  buildId: string;
}

export interface StorageClaimActions {
  onConnectCheck: () => void;
  onBackup: () => void;
  onSaveTick: (saved: boolean) => void;
  onBackupNext: () => void;
  onConfirmTick: (tick: boolean) => void;
  onUnlock: () => void;
  onCheckAgain: () => void;
  onWriteLink: () => void;
  onBackToExport: () => void;
}
