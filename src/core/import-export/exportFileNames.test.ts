import { describe, expect, it } from 'vitest';
import {
  newChannel,
  newFormatBuild,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import { assemble } from '@core/services/assemble.ts';
import { resolveEffectiveExportFileNames } from './exportFileNames.ts';
import { ANYTONE_EXPORT_FILE_NAMES } from './formats/anytone/columns.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function anytoneLibraryWithAirband() {
  const tg = newTalkGroup(PROJECT_ID, 'TG Alpha', 2355);
  const dmrChannel = {
    ...newChannel(PROJECT_ID, 'DMR 1'),
    rxFrequency: 438_800_000,
    txFrequency: 434_000_000,
    modeProfiles: [
      {
        mode: 'dmr' as const,
        colourCode: 1,
        timeslot: 2 as const,
        dmrId: 1234567,
        contactRef: { kind: 'talkGroup' as const, id: tg.id },
        rxGroupListId: null,
      },
    ],
  };
  const airChannel = {
    ...newChannel(PROJECT_ID, 'Tower'),
    forbidTransmit: true,
    txFrequency: null,
    rxFrequency: 118_800_000,
    modeProfiles: [
      {
        mode: 'am' as const,
        squelch: 50,
        rxTone: 'none' as const,
        bandwidthKHz: 8.33,
      },
    ],
  };
  const zone = {
    ...newZone(PROJECT_ID, 'Zone A'),
    members: [
      { kind: 'channel' as const, channelId: dmrChannel.id },
      { kind: 'channel' as const, channelId: airChannel.id },
    ],
  };
  const build = {
    ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
    layout: {
      sections: [
        {
          kind: 'zoneGrouping' as const,
          zones: [{ id: zone.id, name: zone.name, channelIds: [dmrChannel.id, airChannel.id] }],
        },
      ],
    },
  };
  const library = {
    channels: [dmrChannel, airChannel],
    zones: [zone],
    talkGroups: [tg],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    scanLists: [],
  };
  return { build, library };
}

describe('resolveEffectiveExportFileNames', () => {
  it('returns static OpenGD77 file manifest when no conditional resolver', () => {
    const build = newFormatBuild(PROJECT_ID, 'opengd77-1701');
    const library = {
      channels: [newChannel(PROJECT_ID, 'Ch 1')],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const assembled = assemble(build, library);
    const names = resolveEffectiveExportFileNames('opengd77', assembled);
    expect(names).toContain('Channels.csv');
    expect(names).toContain('Zones.csv');
  });

  it('omits Anytone conditional receive banks when not in build', () => {
    const tg = newTalkGroup(PROJECT_ID, 'TG Alpha', 2355);
    const channel = {
      ...newChannel(PROJECT_ID, 'DMR 1'),
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 2 as const,
          dmrId: 1234567,
          contactRef: { kind: 'talkGroup' as const, id: tg.id },
          rxGroupListId: null,
        },
      ],
    };
    const zone = {
      ...newZone(PROJECT_ID, 'Zone A'),
      members: [{ kind: 'channel' as const, channelId: channel.id }],
    };
    const build = {
      ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [{ id: zone.id, name: zone.name, channelIds: [channel.id] }],
          },
        ],
      },
    };
    const library = {
      channels: [channel],
      zones: [zone],
      talkGroups: [tg],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const assembled = assemble(build, library);
    const names = resolveEffectiveExportFileNames('anytone', assembled);

    expect(names).toEqual([...ANYTONE_EXPORT_FILE_NAMES]);
    expect(names).not.toContain('AMAir.CSV');
    expect(names).not.toContain('FM.CSV');
  });

  it('appends AMAir.CSV when airband channels are in the build', () => {
    const { build, library } = anytoneLibraryWithAirband();
    const assembled = assemble(build, library);
    const names = resolveEffectiveExportFileNames('anytone', assembled);

    expect(names).toEqual([...ANYTONE_EXPORT_FILE_NAMES, 'AMAir.CSV']);
  });
});
