import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { emptyLibrary, newChannel, newFormatBuild } from '@core/domain/factories.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { exportBuildZip } from './exportBuild.ts';
import type { NeonplugCodeplugData } from '@core/import-export/formats/neonplug/wireTypes.ts';
import { NEONPLUG_JSON_FILE_NAME } from '@core/import-export/formats/neonplug/serialise.ts';

const projectId = 'proj-neonplug-export';

function fmChannel(id: string, name: string, rxHz: number) {
  return {
    ...newChannel(projectId, name),
    id,
    rxFrequency: rxHz,
    txFrequency: rxHz,
    power: 100,
    modeProfiles: [
      {
        mode: 'fm' as const,
        rxTone: '88.5' as const,
        txTone: '88.5' as const,
        squelch: null,
        bandwidthKHz: 12.5,
      },
    ],
  };
}

function dmrChannel(id: string, name: string) {
  return {
    ...newChannel(projectId, name),
    id,
    rxFrequency: 439_425_000,
    txFrequency: 430_425_000,
    power: 50,
    modeProfiles: [
      {
        mode: 'dmr' as const,
        colourCode: 11,
        timeslot: 2 as const,
        dmrId: null,
        contactRef: null,
        rxGroupListId: null,
      },
    ],
  };
}

function libraryOf(...channels: ReturnType<typeof fmChannel>[]): LibrarySlice {
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
});
