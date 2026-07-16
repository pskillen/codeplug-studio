import { describe, expect, it } from 'vitest';
import { formatDm32RxSquelchModeWire, formatDm32TxAdmitWire } from './wireFormat.ts';

describe('dm32 wireFormat behavioural mapping', () => {
  it('maps txPermit to TX Admit wire', () => {
    expect(formatDm32TxAdmitWire('busyLock')).toBe('Channel Idle');
    expect(formatDm32TxAdmitWire('permitAlways')).toBe('Allow TX');
  });

  it('maps analog squelch mode to RX Squelch Mode wire', () => {
    expect(formatDm32RxSquelchModeWire('carrier')).toBe('Carrier');
    expect(formatDm32RxSquelchModeWire('tone')).toBe('Carrier/CTC');
  });
});
