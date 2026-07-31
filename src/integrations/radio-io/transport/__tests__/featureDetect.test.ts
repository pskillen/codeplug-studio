import { afterEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import {
  getRadioSerialUnsupportedMessage,
  isCapacitorSerialSupported,
  isRadioSerialSupported,
  isWebSerialSupported,
} from '../featureDetect.ts';

describe('featureDetect', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects Web Serial when navigator.serial exists', () => {
    const originalNavigator = globalThis.navigator;
    try {
      Object.defineProperty(globalThis, 'navigator', {
        value: { serial: {} },
        writable: true,
        configurable: true,
      });
      expect(isWebSerialSupported()).toBe(true);
    } finally {
      Object.defineProperty(globalThis, 'navigator', {
        value: originalNavigator,
        writable: true,
        configurable: true,
      });
    }
  });

  it('detects Capacitor serial on native platforms', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    expect(isCapacitorSerialSupported()).toBe(true);
    expect(isRadioSerialSupported()).toBe(true);
  });

  it('provides platform-aware unsupported messages', () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
    const msg = getRadioSerialUnsupportedMessage();
    expect(msg).toContain('On desktop, use Chrome or Edge');
    expect(msg).toContain('Codeplug Studio companion app');
  });
});
