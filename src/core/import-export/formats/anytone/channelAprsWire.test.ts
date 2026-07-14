import { describe, expect, it } from 'vitest';
import { newChannel, newFormatBuild } from '@core/domain/factories.ts';
import { assemble } from '@core/services/assemble.ts';
import { serialiseAnytoneChannelRow } from './channelWire.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function dmrChannel(name: string) {
  return {
    ...newChannel(PROJECT_ID, name),
    rxFrequency: 438_800_000,
    txFrequency: 434_000_000,
    modeProfiles: [
      {
        mode: 'dmr' as const,
        colourCode: 1,
        timeslot: 2 as const,
        dmrId: 1_234_567,
        contactRef: null,
        rxGroupListId: null,
      },
    ],
  };
}

describe('serialiseAnytoneChannelRow APRS columns', () => {
  it('maps Channel.aprs binding to wire columns', () => {
    const channel = {
      ...dmrChannel('APRS Test'),
      aprs: {
        receiveEnabled: true,
        reportType: 'digital' as const,
        digitalPttMode: 'on' as const,
        reportSlotIndex: 2,
      },
    };
    const build = newFormatBuild(PROJECT_ID, 'anytone-at-d890uv');
    const assembled = assemble(build, { channels: [channel], zones: [], talkGroups: [], digitalContacts: [], analogContacts: [], rxGroupLists: [], scanLists: [] });
    const row = assembled.channels[0]!;

    const wire = serialiseAnytoneChannelRow(row, assembled, 'anytone-at-d890uv', 1);

    expect(wire['APRS RX']).toBe('On');
    expect(wire['Digital APRS PTT Mode']).toBe('On');
    expect(wire['APRS Report Type']).toBe('Digital');
    expect(wire['Digital APRS Report Channel']).toBe('2');
    expect(wire['Analog APRS PTT Mode']).toBe('Off');
    expect(wire['Ana APRS Mute']).toBe('0');
    expect(wire['AnaAprsTxPath']).toBe('0');
  });

  it('keeps APRS defaults when channel has no aprs binding', () => {
    const channel = dmrChannel('Plain');
    const build = newFormatBuild(PROJECT_ID, 'anytone-at-d890uv');
    const assembled = assemble(build, { channels: [channel], zones: [], talkGroups: [], digitalContacts: [], analogContacts: [], rxGroupLists: [], scanLists: [] });
    const row = assembled.channels[0]!;

    const wire = serialiseAnytoneChannelRow(row, assembled, 'anytone-at-d890uv', 1);

    expect(wire['APRS RX']).toBe('Off');
    expect(wire['APRS Report Type']).toBe('Off');
    expect(wire['Digital APRS PTT Mode']).toBe('Off');
    expect(wire['Digital APRS Report Channel']).toBe('1');
  });
});
