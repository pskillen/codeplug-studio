import { describe, expect, it } from 'vitest';

import { UV5RMINI_FIRMWARE_UPDATER, UV5RMINI_PREFLIGHT } from './descriptor.ts';

describe('UV-5R Mini updater descriptor', () => {
  it('asks only for a full battery and a dummy load: the pinned hash, not the user, decides the stock file', () => {
    expect(UV5RMINI_PREFLIGHT.attestations.map((a) => a.id)).toEqual([
      'battery-full',
      'dummy-load',
    ]);
    expect(JSON.stringify(UV5RMINI_PREFLIGHT)).not.toMatch(/built from this radio/);
  });

  it('is offered on prod and on Android only with developer mode', () => {
    expect(UV5RMINI_FIRMWARE_UPDATER.prodFlashDisabled).toBe(false);
    expect(UV5RMINI_FIRMWARE_UPDATER.capacitorSupported).toBe('developerMode');
  });

  it('needs no step the Android app refuses: no probe, no safety backup', () => {
    expect(UV5RMINI_FIRMWARE_UPDATER.preflight?.probe).toBeUndefined();
    expect(UV5RMINI_FIRMWARE_UPDATER.preflight?.safetyBackup).toBeUndefined();
  });
});
