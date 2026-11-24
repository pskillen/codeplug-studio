import type { StorageClaimActions, StorageClaimView } from './types.ts';

const noop = (): void => {};

export const DEMO_STORAGE_CLAIM_VIEW: StorageClaimView = {
  step: 'backup',
  busy: false,
  notice: null,
  check: {
    layout: {
      region: 'foreign',
      claimPending: false,
      settings: { address: 0x711000, size: 0x8000 },
      journal: { address: 0x719000, size: 0x2000 },
      calibration: { address: 0, size: 0 },
    },
    boardReported: 'DM-32UV',
    firmwareGit: '454a5b76',
    ranges: [],
  },
  tokenHex: '12345678',
  backupFileName: 'storage_12345678_20261124-150405.zip',
  backupSaved: true,
  confirmTick: false,
  pollPending: false,
  layout: null,
  buildId: 'demo-build',
};

export const DEMO_STORAGE_CLAIM_ACTIONS: StorageClaimActions = {
  onConnectCheck: noop,
  onBackup: noop,
  onSaveTick: noop,
  onBackupNext: noop,
  onConfirmTick: noop,
  onUnlock: noop,
  onCheckAgain: noop,
  onWriteLink: noop,
  onBackToExport: noop,
};
