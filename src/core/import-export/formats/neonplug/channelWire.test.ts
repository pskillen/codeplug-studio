import { describe, expect, it } from 'vitest';
import { newChannel } from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';
import {
  channelToNeonplugChannel,
  formatNeonplugBandwidth,
  formatNeonplugFrequencyMhz,
  formatNeonplugPower,
  formatNeonplugSlotOperation,
  formatNeonplugTone,
} from './channelWire.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

function channel(patch: Partial<Channel> = {}): Channel {
  return {
    ...newChannel(projectId, 'Test'),
    rxFrequency: 145_500_000,
    txFrequency: 145_500_000,
    modeProfiles: [
      {
        mode: 'fm',
        rxTone: 'none',
        txTone: 'none',
        squelch: null,
        bandwidthKHz: 12.5,
      },
    ],
    ...patch,
  };
}

describe('neonplug/channelWire helpers', () => {
  it('converts Hz to MHz', () => {
    expect(formatNeonplugFrequencyMhz(145_350_000)).toBe(145.35);
    expect(formatNeonplugFrequencyMhz(null)).toBe(0);
  });

  it('maps power Middle ladder wire to NeonPlug Medium', () => {
    expect(formatNeonplugPower(50, 'neonplug-dm32uv')).toBe('Medium');
    expect(formatNeonplugPower(100, 'neonplug-dm32uv')).toBe('High');
    expect(formatNeonplugPower(20, 'neonplug-dm32uv')).toBe('Low');
    expect(formatNeonplugPower(100, 'neonplug-uv5rmini')).toBe('High');
    expect(formatNeonplugPower(20, 'neonplug-uv5rmini')).toBe('Low');
  });

  it('maps bandwidth', () => {
    expect(formatNeonplugBandwidth(12.5)).toBe('12.5kHz');
    expect(formatNeonplugBandwidth(25)).toBe('25kHz');
    expect(formatNeonplugBandwidth(null)).toBe('12.5kHz');
  });

  it('maps CTCSS and DCS tones', () => {
    expect(formatNeonplugTone('none')).toEqual({ type: 'None' });
    expect(formatNeonplugTone('88.5')).toEqual({ type: 'CTCSS', value: 88.5 });
    expect(formatNeonplugTone('D023N')).toEqual({ type: 'DCS', value: 23, polarity: 'N' });
    expect(formatNeonplugTone('D047P')).toEqual({ type: 'DCS', value: 47, polarity: 'P' });
  });

  it('maps timeslot to NeonPlug slotOperation storage', () => {
    expect(formatNeonplugSlotOperation(1)).toBe(0);
    expect(formatNeonplugSlotOperation(2)).toBe(1);
    expect(formatNeonplugSlotOperation(null)).toBe(0);
  });
});

describe('channelToNeonplugChannel', () => {
  it('exports an analogue simplex channel', () => {
    const wire = channelToNeonplugChannel(
      channel({
        name: 'Simplex',
        power: 100,
        modeProfiles: [
          {
            mode: 'fm',
            rxTone: '88.5',
            txTone: '88.5',
            squelch: 50,
            bandwidthKHz: 12.5,
          },
        ],
      }),
      { number: 1, name: 'Simplex', profileId: 'neonplug-dm32uv' },
    );

    expect(wire.number).toBe(1);
    expect(wire.name).toBe('Simplex');
    expect(wire.mode).toBe('Analog');
    expect(wire.rxFrequency).toBe(145.5);
    expect(wire.txFrequency).toBe(145.5);
    expect(wire.power).toBe('High');
    expect(wire.bandwidth).toBe('12.5kHz');
    expect(wire.rxCtcssDcs).toEqual({ type: 'CTCSS', value: 88.5 });
    expect(wire.txCtcssDcs).toEqual({ type: 'CTCSS', value: 88.5 });
    expect(wire.forbidTx).toBe(false);
    expect(wire.scanAdd).toBe(true);
    expect(wire.contactId).toBe(0);
    expect(wire.slotOperation).toBeUndefined();
  });

  it('exports a digital channel with CC and slot', () => {
    const wire = channelToNeonplugChannel(
      channel({
        name: 'DMR TG',
        power: 50,
        modeProfiles: [
          {
            mode: 'dmr',
            colourCode: 11,
            timeslot: 2,
            dmrId: null,
            contactRef: null,
            rxGroupListId: null,
          },
        ],
      }),
      { number: 3, name: 'DMR TG', profileId: 'neonplug-dm32uv' },
    );

    expect(wire.mode).toBe('Digital');
    expect(wire.power).toBe('Medium');
    expect(wire.colorCode).toBe(11);
    expect(wire.slotOperation).toBe(1);
    expect(wire.contactId).toBe(0);
    expect(wire.rxGroupListId).toBe(0);
    expect(wire.rxCtcssDcs).toEqual({ type: 'None' });
  });

  it('exports Fixed Digital when dual-mode and primary is dmr', () => {
    const wire = channelToNeonplugChannel(
      channel({
        primaryMode: 'dmr',
        modeProfiles: [
          {
            mode: 'fm',
            rxTone: 'none',
            txTone: 'none',
            squelch: null,
            bandwidthKHz: 12.5,
          },
          {
            mode: 'dmr',
            colourCode: 1,
            timeslot: 1,
            dmrId: null,
            contactRef: null,
            rxGroupListId: null,
          },
        ],
      }),
      { number: 5, name: 'Dual', profileId: 'neonplug-dm32uv' },
    );
    expect(wire.mode).toBe('Fixed Digital');
  });

  it('sets forbidTx and scanAdd from channel overrides', () => {
    const wire = channelToNeonplugChannel(
      channel({
        forbidTransmit: 'forbid',
        scanInclusion: 'skip',
      }),
      { number: 2, name: 'Listen', profileId: 'neonplug-uv5rmini' },
    );
    expect(wire.forbidTx).toBe(true);
    expect(wire.scanAdd).toBe(false);
  });

  it('maps APRS receive and digital report mode', () => {
    const wire = channelToNeonplugChannel(
      channel({
        aprs: {
          receiveEnabled: true,
          reportType: 'digital',
          digitalPttMode: 'off',
          reportSlotIndex: 1,
        },
        modeProfiles: [
          {
            mode: 'dmr',
            colourCode: 1,
            timeslot: 1,
            dmrId: null,
            contactRef: null,
            rxGroupListId: null,
          },
        ],
      }),
      { number: 4, name: 'APRS', profileId: 'neonplug-dm32uv' },
    );
    expect(wire.aprsReceive).toBe(true);
    expect(wire.aprsReportMode).toBe('Digital');
  });
});
