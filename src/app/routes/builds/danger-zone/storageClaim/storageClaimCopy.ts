export const COPY = {
  title: 'Unlock settings storage',
  strap:
    'Claims the settings flash area so RadioFoundry can save your codeplug. Studio backs up the old bytes first; they cannot be put back with Studio or RadioFoundry.',
  nothingChanged: 'Nothing has changed.',
  oursDone: 'Storage unlocked. Write the radio again.',
  checkAgain: 'Check again',
  unlockLabel: 'Unlock storage',
  backupTick: "I've saved the backup file",
  cost: "The radio erases its 40 KB settings area (about 4 s). Don't switch it off.",
  noRestore:
    "Studio and RadioFoundry cannot put these bytes back. They are the old firmware's zone and RX-list fragments — keep the file if you might return to stock with the vendor's tools.",
} as const;

export const STEP_LABELS = {
  check: 'Check',
  backup: 'Back up',
  confirm: 'Confirm',
  unlock: 'Unlock',
  done: 'Done',
} as const;

export const STORAGE_CLAIM_STEPS = ['check', 'backup', 'confirm', 'unlock'] as const;
