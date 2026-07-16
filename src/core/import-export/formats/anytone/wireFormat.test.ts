import { describe, expect, it } from 'vitest';
import type { Channel, ChannelModeProfileDMR } from '@core/models/library.ts';
import { newChannel } from '@core/domain/factories.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import {
  formatAnytoneBusyLockFromTxPermit,
  formatAnytoneBusyLockTxPermit,
  formatAnytoneChannelTypeFromChannel,
  formatAnytoneDmrModeWire,
  formatAnytoneSquelchModeFromResolved,
  formatAnytoneTalkerAliasWire,
} from './wireFormat.ts';

describe('anytone wireFormat channel mode mapping', () => {
  it('maps single DMR channel to D-Digital', () => {
    const channel: Channel = {
      ...newChannel('p', 'Test'),
      modeProfiles: [defaultModeProfile('dmr')],
    };
    expect(formatAnytoneChannelTypeFromChannel(channel)).toBe('D-Digital');
  });

  it('maps single FM channel to A-Analog', () => {
    const channel: Channel = {
      ...newChannel('p', 'Test'),
      modeProfiles: [defaultModeProfile('fm')],
    };
    expect(formatAnytoneChannelTypeFromChannel(channel)).toBe('A-Analog');
  });

  it('maps dual-mode with primary DMR to D+A TX D', () => {
    const channel: Channel = {
      ...newChannel('p', 'Test'),
      primaryMode: 'dmr' as const,
      modeProfiles: [defaultModeProfile('fm'), defaultModeProfile('dmr')],
    };
    expect(formatAnytoneChannelTypeFromChannel(channel)).toBe('D+A TX D');
  });

  it('maps dual-mode with primary FM to A+D TX A', () => {
    const channel: Channel = {
      ...newChannel('p', 'Test'),
      primaryMode: 'fm' as const,
      modeProfiles: [defaultModeProfile('fm'), defaultModeProfile('dmr')],
    };
    expect(formatAnytoneChannelTypeFromChannel(channel)).toBe('A+D TX A');
  });

  it('maps Busy Lock for digital TX primary', () => {
    expect(formatAnytoneBusyLockFromTxPermit('busyLock', 'D-Digital')).toBe('ChannelFree');
    expect(formatAnytoneBusyLockFromTxPermit('busyLock', 'D+A TX D')).toBe('ChannelFree');
  });

  it('maps Busy Lock for analog TX primary', () => {
    expect(formatAnytoneBusyLockFromTxPermit('busyLock', 'A-Analog')).toBe('Channel Free');
    expect(formatAnytoneBusyLockFromTxPermit('busyLock', 'A+D TX A')).toBe('Channel Free');
  });

  it('maps permitAlways for digital TX primary', () => {
    const digital: Channel = {
      ...newChannel('p', 'Test'),
      modeProfiles: [defaultModeProfile('dmr')],
    };
    expect(formatAnytoneBusyLockTxPermit(digital)).toBe('Always');
  });

  it('maps permitAlways for analog TX primary', () => {
    const analog: Channel = {
      ...newChannel('p', 'Test'),
      modeProfiles: [defaultModeProfile('fm')],
    };
    expect(formatAnytoneBusyLockTxPermit(analog)).toBe('Off');
  });

  it('maps split frequencies to repeater DMR MODE wire 1', () => {
    const channel: Channel = {
      ...newChannel('p', 'Test'),
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      modeProfiles: [defaultModeProfile('dmr')],
    };
    expect(formatAnytoneDmrModeWire(channel)).toBe('1');
  });

  it('maps simplex frequencies to DMO DMR MODE wire 0', () => {
    const channel: Channel = {
      ...newChannel('p', 'Test'),
      rxFrequency: 145_000_000,
      txFrequency: 145_000_000,
      modeProfiles: [defaultModeProfile('dmr')],
    };
    expect(formatAnytoneDmrModeWire(channel)).toBe('0');
  });

  it('uses explicit profile dmrMode over frequency inference', () => {
    const channel: Channel = {
      ...newChannel('p', 'Test'),
      rxFrequency: 145_000_000,
      txFrequency: 145_000_000,
      modeProfiles: [
        { ...(defaultModeProfile('dmr') as ChannelModeProfileDMR), dmrMode: 'repeater' },
      ],
    };
    expect(formatAnytoneDmrModeWire(channel)).toBe('1');
  });

  it('maps resolved squelch mode to wire', () => {
    expect(formatAnytoneSquelchModeFromResolved('carrier')).toBe('Carrier');
    expect(formatAnytoneSquelchModeFromResolved('tone')).toBe('CTCSS/DCS');
  });

  it('maps talker alias mode to wire digit', () => {
    expect(formatAnytoneTalkerAliasWire('on')).toBe('1');
    expect(formatAnytoneTalkerAliasWire('off')).toBe('0');
  });
});
