import { describe, expect, it } from 'vitest';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import { newAprsConfiguration, newChannel, newFormatBuild } from '@core/domain/factories.ts';
import { assemble } from '@core/services/assemble.ts';
import {
  ANYTONE_GOLDEN_PROJECT_ID,
  aprsEnabledAnytoneExportLibrary,
  minimalAnytoneExportBuild,
} from './exportGoldenFixtures.ts';
import { buildAnytoneExportChannelSlotById, serialiseAprsCsv } from './exportAprsWire.ts';
import { prepareAnytoneExportAssembly } from './prepareExportAssembly.ts';
import { parseCsv } from '@core/import-export/csvParse.ts';

const PROJECT_ID = ANYTONE_GOLDEN_PROJECT_ID;

function airbandChannel(name = 'Air station 1') {
  return {
    ...newChannel(PROJECT_ID, name),
    rxFrequency: 118_800_000,
    txFrequency: null,
    forbidTransmit: true,
    modeProfiles: [defaultModeProfile('am')],
  };
}

function fmBroadcastChannel(name = 'FM station 1') {
  return {
    ...newChannel(PROJECT_ID, name),
    rxFrequency: 99_500_000,
    txFrequency: null,
    forbidTransmit: true,
    modeProfiles: [defaultModeProfile('fm')],
  };
}

function mainBankAnalogFm(name = 'Analog FM') {
  return {
    ...newChannel(PROJECT_ID, name),
    rxFrequency: 145_500_000,
    txFrequency: 145_500_000,
    forbidTransmit: false,
    modeProfiles: [defaultModeProfile('fm')],
  };
}

describe('buildAnytoneExportChannelSlotById', () => {
  it('resolves DMR channel slot from Channel.CSV order', () => {
    const library = aprsEnabledAnytoneExportLibrary();
    const build = minimalAnytoneExportBuild(library);
    const assembled = assemble(build, library);
    const prepared = prepareAnytoneExportAssembly(assembled, library);
    const slotById = buildAnytoneExportChannelSlotById(assembled, prepared);

    expect(slotById.get(library.channels[0]!.id)).toBe(1);
    expect(slotById.get(library.channels[1]!.id)).toBe(2);
  });

  it('resolves AM air channel slot from AMAir.CSV order', () => {
    const airband = airbandChannel();
    const library = {
      channels: [airband],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
      aprsConfiguration: newAprsConfiguration(PROJECT_ID, 'APRS'),
    };
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: { sections: [] },
      channelOverrides: [{ libraryEntityId: airband.id, wireName: 'Air station 1' }],
    };
    const assembled = assemble(build, library);
    const prepared = prepareAnytoneExportAssembly(assembled, library);

    expect(buildAnytoneExportChannelSlotById(assembled, prepared).get(airband.id)).toBe(1);
  });

  it('resolves FM broadcast channel slot from FM.CSV order', () => {
    const fm = fmBroadcastChannel();
    const library = {
      channels: [fm],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
      aprsConfiguration: newAprsConfiguration(PROJECT_ID, 'APRS'),
    };
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: { sections: [] },
      channelOverrides: [{ libraryEntityId: fm.id, wireName: 'FM station 1' }],
    };
    const assembled = assemble(build, library);
    const prepared = prepareAnytoneExportAssembly(assembled, library);

    expect(buildAnytoneExportChannelSlotById(assembled, prepared).get(fm.id)).toBe(1);
  });

  it('resolves main-bank analog FM channel from Channel.CSV order', () => {
    const analog = mainBankAnalogFm();
    const library = {
      channels: [analog],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
      aprsConfiguration: newAprsConfiguration(PROJECT_ID, 'APRS'),
    };
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: { sections: [] },
      channelOverrides: [{ libraryEntityId: analog.id, wireName: 'Analog FM' }],
    };
    const assembled = assemble(build, library);
    const prepared = prepareAnytoneExportAssembly(assembled, library);

    expect(buildAnytoneExportChannelSlotById(assembled, prepared).get(analog.id)).toBe(1);
  });
});

describe('serialiseAprsCsv analog slot binding', () => {
  it('writes AMAir No. into channel1 and warns when channel is missing from build', () => {
    const airband = airbandChannel();
    const orphanId = '22222222-2222-4222-8222-222222222222';
    const config = {
      ...newAprsConfiguration(PROJECT_ID, 'APRS'),
      channelSlots: [
        {
          channelRef: { kind: 'channel' as const, id: airband.id },
          timeslot: 1 as const,
          targetDmrId: 2355,
          callType: 'group' as const,
        },
        {
          channelRef: { kind: 'channel' as const, id: orphanId },
          timeslot: 2 as const,
          targetDmrId: 2355,
          callType: 'group' as const,
        },
      ],
    };
    const library = {
      channels: [airband],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
      aprsConfiguration: config,
    };
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: { sections: [] },
      channelOverrides: [{ libraryEntityId: airband.id, wireName: 'Air station 1' }],
    };
    const assembled = assemble(build, library);
    const prepared = prepareAnytoneExportAssembly(assembled, library);
    const warnings: string[] = [];
    const csv = serialiseAprsCsv(config, assembled, prepared, undefined, warnings);
    const parsed = parseCsv(csv);
    const headers = parsed[0]!;
    const row = parsed[1]!;

    expect(row[headers.indexOf('channel1')]).toBe('1');
    expect(row[headers.indexOf('channel2')]).toBe('0');
    expect(warnings.some((w) => w.includes(orphanId))).toBe(true);
  });
});
