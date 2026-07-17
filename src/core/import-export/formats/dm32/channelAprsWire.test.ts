import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import { newChannel, newFormatBuild } from '@core/domain/factories.ts';
import { assemble, type LibrarySlice } from '@core/services/assemble.ts';
import { CHANNEL_COL } from './columns.ts';
import { expandAllDm32ChannelsForExport } from './channelExpansion.ts';
import { serialiseDm32ChannelRow } from './channelWire.ts';
import { buildDm32TalkGroupWireNameMap } from './talkGroupWire.ts';
import {
  dm32ChannelAprsWireCells,
  formatDm32AprsReportChannelWire,
} from './aprsWireFormat.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function fmChannel(name: string, overrides: Partial<Channel> = {}): Channel {
  return {
    ...newChannel(PROJECT_ID, name),
    rxFrequency: 145_500_000,
    txFrequency: 145_500_000,
    modeProfiles: [{ mode: 'fm', squelch: 50, rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 }],
    ...overrides,
  };
}

function dmrChannel(name: string, overrides: Partial<Channel> = {}): Channel {
  return {
    ...newChannel(PROJECT_ID, name),
    rxFrequency: 438_800_000,
    txFrequency: 434_000_000,
    modeProfiles: [
      {
        mode: 'dmr',
        colourCode: 1,
        timeslot: 1,
        dmrId: 1_234_567,
        contactRef: null,
        rxGroupListId: null,
      },
    ],
    ...overrides,
  };
}

function serialiseChannel(channel: Channel): Record<string, string> {
  const build = newFormatBuild(PROJECT_ID, 'dm32-baofeng-dm32uv');
  const library: LibrarySlice = {
    channels: [channel],
    zones: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    scanLists: [],
  };
  const assembled = assemble(build, library);
  const expanded = expandAllDm32ChannelsForExport(assembled, library);
  const row = expanded[0]!;
  const talkGroupWireNames = buildDm32TalkGroupWireNameMap(assembled);
  return serialiseDm32ChannelRow(
    row,
    channel,
    assembled,
    'dm32-baofeng-dm32uv',
    1,
    talkGroupWireNames,
  );
}

describe('dm32ChannelAprsWireCells', () => {
  it('defaults off values when binding is missing', () => {
    expect(dm32ChannelAprsWireCells(undefined, 'fm')).toEqual({
      aprsReportType: 'Off',
      aprsReceive: '0',
      analogAprsPtt: '0',
      digitalAprsPtt: '0',
      aprsReportChannel: '256',
    });
    expect(dm32ChannelAprsWireCells(undefined, 'dmr')).toEqual({
      aprsReportType: 'Off',
      aprsReceive: '0',
      analogAprsPtt: '0',
      digitalAprsPtt: '0',
      aprsReportChannel: '1',
    });
  });

  it('emits slot index for digital reporting on analog channels', () => {
    expect(
      formatDm32AprsReportChannelWire(
        {
          receiveEnabled: true,
          reportType: 'digital',
          digitalPttMode: 'on',
          reportSlotIndex: 3,
        },
        'fm',
      ),
    ).toBe('3');
  });
});

describe('serialiseDm32ChannelRow APRS columns', () => {
  it('maps Channel.aprs binding on a digital channel', () => {
    const wire = serialiseChannel(
      dmrChannel('APRS Digi', {
        aprs: {
          receiveEnabled: true,
          reportType: 'digital',
          digitalPttMode: 'on',
          reportSlotIndex: 2,
        },
      }),
    );

    expect(wire[CHANNEL_COL.aprsReportType]).toBe('Digital');
    expect(wire[CHANNEL_COL.aprsReceive]).toBe('1');
    expect(wire[CHANNEL_COL.digitalAprsPtt]).toBe('1');
    expect(wire[CHANNEL_COL.analogAprsPtt]).toBe('0');
    expect(wire[CHANNEL_COL.aprsReportChannel]).toBe('2');
  });

  it('maps digital APRS binding on an analog channel (no analog APRS hardware)', () => {
    const wire = serialiseChannel(
      fmChannel('APRS Analog', {
        aprs: {
          receiveEnabled: true,
          reportType: 'digital',
          digitalPttMode: 'off',
          reportSlotIndex: 4,
        },
      }),
    );

    expect(wire[CHANNEL_COL.aprsReportType]).toBe('Digital');
    expect(wire[CHANNEL_COL.aprsReceive]).toBe('1');
    expect(wire[CHANNEL_COL.digitalAprsPtt]).toBe('0');
    expect(wire[CHANNEL_COL.analogAprsPtt]).toBe('0');
    expect(wire[CHANNEL_COL.aprsReportChannel]).toBe('4');
  });

  it('uses 256 placeholder when analog channel has no APRS binding', () => {
    const wire = serialiseChannel(fmChannel('Plain FM'));
    expect(wire[CHANNEL_COL.aprsReportType]).toBe('Off');
    expect(wire[CHANNEL_COL.aprsReceive]).toBe('0');
    expect(wire[CHANNEL_COL.aprsReportChannel]).toBe('256');
  });

  it('ignores reportSlotIndex when report type is off', () => {
    const wire = serialiseChannel(
      dmrChannel('APRS Off', {
        aprs: {
          receiveEnabled: true,
          reportType: 'off',
          digitalPttMode: 'off',
          reportSlotIndex: 5,
        },
      }),
    );
    expect(wire[CHANNEL_COL.aprsReportType]).toBe('Off');
    expect(wire[CHANNEL_COL.aprsReceive]).toBe('1');
    expect(wire[CHANNEL_COL.aprsReportChannel]).toBe('1');
  });
});
