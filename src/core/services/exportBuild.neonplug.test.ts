import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { emptyLibrary, newChannel, newFormatBuild } from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { exportBuildZip } from './exportBuild.ts';
import type { NeonplugCodeplugData } from '@core/import-export/formats/neonplug/wireTypes.ts';
import { NEONPLUG_JSON_FILE_NAME } from '@core/import-export/formats/neonplug/serialise.ts';
import { buildNeonplugZip } from '@core/import-export/formats/neonplug/packageZip.ts';

const projectId = 'proj-neonplug-export';

function fmChannel(id: string, name: string, rxHz: number): Channel {
  return {
    ...newChannel(projectId, name),
    id,
    rxFrequency: rxHz,
    txFrequency: rxHz,
    power: 100,
    modeProfiles: [
      {
        mode: 'fm',
        rxTone: '88.5',
        txTone: '88.5',
        squelch: null,
        bandwidthKHz: 12.5,
      },
    ],
  };
}

function dmrChannel(id: string, name: string): Channel {
  return {
    ...newChannel(projectId, name),
    id,
    rxFrequency: 439_425_000,
    txFrequency: 430_425_000,
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
  };
}

function libraryOf(...channels: Channel[]): LibrarySlice {
  return {
    ...emptyLibrary(),
    channels,
  };
}

function parseZip(zip: Uint8Array): NeonplugCodeplugData {
  const entries = unzipSync(zip);
  const raw = entries[NEONPLUG_JSON_FILE_NAME];
  expect(raw).toBeDefined();
  return JSON.parse(strFromU8(raw!)) as NeonplugCodeplugData;
}

describe('exportBuildZip neonplug', () => {
  it('exports DM32UV channels with sequential numbers into a .neonplug ZIP', () => {
    const chFm = fmChannel('ch-fm', 'GB3AO', 145_600_000);
    const chDmr = dmrChannel('ch-dmr', 'GB7EM');
    const build = newFormatBuild(projectId, 'neonplug-dm32uv', 'Neon DM32');
    const { zip, files, warnings } = exportBuildZip({
      build,
      library: libraryOf(chFm, chDmr),
      options: { shortenNames: false },
    });

    expect(Object.keys(files)).toEqual([NEONPLUG_JSON_FILE_NAME]);
    expect(warnings.every((w) => !/truncat|exceeds \d+ characters/i.test(w))).toBe(true);

    const data = parseZip(zip);
    expect(data.version).toBe('1.0.0');
    expect(data.radioInfo.model).toBe('DP570UV');
    expect(data.zones).toEqual([]);
    expect(data.contacts).toEqual([]);
    expect(data.channels).toHaveLength(2);
    expect(data.channels[0]).toMatchObject({
      number: 1,
      name: 'GB3AO',
      mode: 'Analog',
      rxFrequency: 145.6,
      power: 'High',
      rxCtcssDcs: { type: 'CTCSS', value: 88.5 },
      contactId: 0,
    });
    expect(data.channels[1]).toMatchObject({
      number: 2,
      name: 'GB7EM',
      mode: 'Digital',
      colorCode: 11,
      slotOperation: 1,
      power: 'Medium',
      contactId: 0,
    });
  });

  it('exports UV5R-Mini using flat-memory slot numbers', () => {
    const ch1 = fmChannel('ch-1', 'First', 145_500_000);
    const ch2 = fmChannel('ch-2', 'Second', 433_500_000);
    const build = {
      ...newFormatBuild(projectId, 'neonplug-uv5rmini', 'Neon UV5R'),
      channelOverrides: [
        { libraryEntityId: ch2.id, orderOrSlot: 2 },
        { libraryEntityId: ch1.id, orderOrSlot: 5 },
      ],
    };

    const { zip } = exportBuildZip({
      build,
      library: libraryOf(ch1, ch2),
      options: { shortenNames: false },
    });

    const data = parseZip(zip);
    expect(data.radioInfo.model).toBe('UV5R-Mini');
    expect(data.channels.map((c) => ({ number: c.number, name: c.name }))).toEqual([
      { number: 2, name: 'Second' },
      { number: 5, name: 'First' },
    ]);
  });

  it('merges Studio projection into a donor .neonplug base', () => {
    const chFm = fmChannel('ch-fm', 'GB3AO', 145_600_000);
    const build = newFormatBuild(projectId, 'neonplug-dm32uv', 'Neon DM32');
    const baseBody = JSON.stringify({
      version: '1.0.0',
      exportDate: '2020-01-01T00:00:00.000Z',
      channels: [{ number: 99, name: 'OLD' }],
      zones: [{ number: 1, name: 'OldZone', channelNumbers: [99] }],
      scanLists: [],
      contacts: [],
      rxGroups: [],
      radioIds: [{ index: 0, dmrId: '2345678', name: 'Op' }],
      quickContacts: [{ index: 1 }],
      messages: ['Keep me'],
      digitalEmergencies: [],
      analogEmergencies: [],
      encryptionKeys: [],
      digitalEmergencyConfig: { countIndex: 2 },
      radioSettings: { powerOnDisplayLine1: 'RADIO' },
      radioInfo: { model: 'DP570UV', firmware: 'donor-fw' },
    });
    const baseNeonplugBytes = buildNeonplugZip({ [NEONPLUG_JSON_FILE_NAME]: baseBody });

    const { zip, warnings } = exportBuildZip({
      build,
      library: libraryOf(chFm),
      options: { shortenNames: false },
      baseNeonplugBytes,
    });

    const data = parseZip(zip);
    expect(data.radioSettings).toEqual({ powerOnDisplayLine1: 'RADIO' });
    expect(data.radioIds).toEqual([{ index: 0, dmrId: '2345678', name: 'Op' }]);
    expect(data.messages).toEqual(['Keep me']);
    expect(data.radioInfo.firmware).toBe('donor-fw');
    expect(data.channels).toHaveLength(1);
    expect(data.channels[0]?.name).toBe('GB3AO');
    expect(data.zones).toEqual([]);
    expect(data.exportDate).not.toBe('2020-01-01T00:00:00.000Z');
    expect(warnings.every((w) => !/UV5R-Mini/.test(w))).toBe(true);
  });

  it('merges using build.cpsWireHydration when no session donor bytes', () => {
    const chFm = fmChannel('ch-fm', 'GB3AO', 145_600_000);
    const build = {
      ...newFormatBuild(projectId, 'neonplug-dm32uv', 'Neon DM32'),
      cpsWireHydration: {
        formatId: 'neonplug' as const,
        sourceFileName: 'radio.neonplug',
        capturedAt: '2026-07-20T12:00:00.000Z',
        retain: {
          radioIds: [{ index: 0, dmrId: '111', dmrIdValue: 111, dmrIdBytes: [111], name: 'Me' }],
          quickContacts: [],
          messages: ['stored'],
          digitalEmergencies: [],
          analogEmergencies: [],
          encryptionKeys: [],
          digitalEmergencyConfig: null,
          radioSettings: { powerOnDisplayLine1: 'STORED' },
          radioInfo: { model: 'DP570UV', firmware: 'hydrated' },
        },
      },
    };

    const { zip } = exportBuildZip({
      build,
      library: libraryOf(chFm),
      options: { shortenNames: false },
    });

    const data = parseZip(zip);
    expect(data.radioSettings).toEqual({ powerOnDisplayLine1: 'STORED' });
    expect(data.messages).toEqual(['stored']);
    expect(data.radioInfo.firmware).toBe('hydrated');
    expect(data.channels[0]?.name).toBe('GB3AO');
  });
});
