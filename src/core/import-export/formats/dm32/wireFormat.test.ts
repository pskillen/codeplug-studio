import { describe, expect, it } from 'vitest';
import {
  formatDm32RxSquelchModeWire,
  formatDm32ToneWire,
  formatDm32TxAdmitWire,
} from './wireFormat.ts';

describe('dm32 wireFormat behavioural mapping', () => {
  it('maps txPermit to TX Admit wire', () => {
    expect(formatDm32TxAdmitWire('busyLock')).toBe('Channel Idle');
    expect(formatDm32TxAdmitWire('permitAlways')).toBe('Allow TX');
  });

  it('maps analog squelch mode to RX Squelch Mode wire', () => {
    expect(formatDm32RxSquelchModeWire('carrier')).toBe('Carrier');
    expect(formatDm32RxSquelchModeWire('tone')).toBe('Carrier/CTC');
  });

  it('emits canonical inverted DCS and leaves CTCSS', () => {
    expect(formatDm32ToneWire('D047P')).toBe('D047I');
    expect(formatDm32ToneWire('D023I')).toBe('D023I');
    expect(formatDm32ToneWire('88.5')).toBe('88.5');
    expect(formatDm32ToneWire('none')).toBe('None');
  });
});
