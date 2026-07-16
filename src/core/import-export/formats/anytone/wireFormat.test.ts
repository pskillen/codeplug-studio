import { describe, expect, it } from 'vitest';
import { newChannel } from '@core/domain/factories.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import {
  formatAnytoneBusyLockTxPermit,
  formatAnytoneChannelTypeFromChannel,
  formatAnytoneDmrModeWire,
  formatAnytoneSquelchMode,
} from './wireFormat.ts';

describe('anytone wireFormat channel mode mapping', () => {
  it('maps single DMR channel to D-Digital', () => {
    const channel = {
      ...newChannel('p', 'Test'),
      modeProfiles: [defaultModeProfile('dmr')],
    };
    expect(formatAnytoneChannelTypeFromChannel(channel)).toBe('D-Digital');
  });

  it('maps single FM channel to A-Analog', () => {
    const channel = {
      ...newChannel('p', 'Test'),
      modeProfiles: [defaultModeProfile('fm')],
    };
    expect(formatAnytoneChannelTypeFromChannel(channel)).toBe('A-Analog');
  });

  it('maps dual-mode with primary DMR to D+A TX D', () => {
    const channel = {
      ...newChannel('p', 'Test'),
      primaryMode: 'dmr' as const,
      modeProfiles: [defaultModeProfile('fm'), defaultModeProfile('dmr')],
    };
    expect(formatAnytoneChannelTypeFromChannel(channel)).toBe('D+A TX D');
  });

  it('maps dual-mode with primary FM to A+D TX A', () => {
    const channel = {
      ...newChannel('p', 'Test'),
      primaryMode: 'fm' as const,
      modeProfiles: [defaultModeProfile('fm'), defaultModeProfile('dmr')],
    };
    expect(formatAnytoneChannelTypeFromChannel(channel)).toBe('A+D TX A');
  });

  it('exports ChannelFree Busy Lock for digital TX primary', () => {
    const digital = {
      ...newChannel('p', 'Test'),
      modeProfiles: [defaultModeProfile('dmr')],
    };
    const dualDigitalTx = {
      ...newChannel('p', 'Test'),
      primaryMode: 'dmr' as const,
      modeProfiles: [defaultModeProfile('fm'), defaultModeProfile('dmr')],
    };
    expect(formatAnytoneBusyLockTxPermit(digital)).toBe('ChannelFree');
    expect(formatAnytoneBusyLockTxPermit(dualDigitalTx)).toBe('ChannelFree');
  });

  it('exports Channel Free Busy Lock for analog TX primary', () => {
    const analog = {
      ...newChannel('p', 'Test'),
      modeProfiles: [defaultModeProfile('fm')],
    };
    const dualAnalogTx = {
      ...newChannel('p', 'Test'),
      primaryMode: 'fm' as const,
      modeProfiles: [defaultModeProfile('fm'), defaultModeProfile('dmr')],
    };
    expect(formatAnytoneBusyLockTxPermit(analog)).toBe('Channel Free');
    expect(formatAnytoneBusyLockTxPermit(dualAnalogTx)).toBe('Channel Free');
  });

  it('maps split frequencies to repeater DMR MODE wire 1', () => {
    const channel = {
      ...newChannel('p', 'Test'),
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      modeProfiles: [defaultModeProfile('dmr')],
    };
    expect(formatAnytoneDmrModeWire(channel)).toBe('1');
  });

  it('maps simplex frequencies to DMO DMR MODE wire 0', () => {
    const channel = {
      ...newChannel('p', 'Test'),
      rxFrequency: 145_000_000,
      txFrequency: 145_000_000,
      modeProfiles: [defaultModeProfile('dmr')],
    };
    expect(formatAnytoneDmrModeWire(channel)).toBe('0');
  });

  it('uses explicit profile dmrMode over frequency inference', () => {
    const channel = {
      ...newChannel('p', 'Test'),
      rxFrequency: 145_000_000,
      txFrequency: 145_000_000,
      modeProfiles: [{ ...defaultModeProfile('dmr'), dmrMode: 'repeater' as const }],
    };
    expect(formatAnytoneDmrModeWire(channel)).toBe('1');
  });

  it('maps Squelch Mode from RX tone', () => {
    expect(formatAnytoneSquelchMode(undefined)).toBe('Carrier');
    expect(formatAnytoneSquelchMode('none')).toBe('Carrier');
    expect(formatAnytoneSquelchMode('88.5')).toBe('CTCSS/DCS');
    expect(formatAnytoneSquelchMode('D023N')).toBe('CTCSS/DCS');
  });
});
