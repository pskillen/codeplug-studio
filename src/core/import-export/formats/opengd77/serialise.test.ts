import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import {
  newChannel,
  newFormatBuild,
  newTalkGroup,
  newZone,
  newRxGroupList,
  newDigitalContact,
} from '@core/domain/factories.ts';
import { parseProjectDocument } from '@core/import-export/formats/native-yaml/parse.ts';
import {
  FIXTURE_CHANNEL_A_ID,
  FIXTURE_CHANNEL_B_ID,
  FIXTURE_CHILD_ZONE_ID,
  FIXTURE_PARENT_ZONE_ID,
  FIXTURE_PROJECT_ID,
  glasgowPmrNestedAggregate,
} from '@core/import-export/formats/native-yaml/testFixtures.ts';
import { assemble } from '@core/services/assemble.ts';
import { exportBuildAll } from '@core/services/exportBuild.ts';
import { compareCsvRecords } from '../../../../test/csvRecordCompare.ts';
import { parseCsv } from '@core/import-export/csvParse.ts';
import { CHANNEL_COL, CONTACT_COL, RX_GROUP_LIST_COL } from './columns.ts';
import { serialiseChannels, serialiseOpenGd77Files, serialiseZones } from './serialise.ts';
import { collectOpenGd77ExportWarnings } from './warnings.ts';

const fixtureDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../native-yaml/__fixtures__/export',
);

describe('OpenGD77 export serialise', () => {
  function bandwidthForChannel(csv: string, channelName: string): string {
    const rows = parseCsv(csv);
    const headers = rows[0]!;
    const nameIndex = headers.indexOf(CHANNEL_COL.name);
    const bandwidthIndex = headers.indexOf(CHANNEL_COL.bandwidth);
    const dataRow = rows.slice(1).find((row) => row[nameIndex] === channelName);
    return dataRow?.[bandwidthIndex] ?? '';
  }

  function minimalAssembled(channel: Channel): AssembledBuild {
    return {
      buildId: 'build-1',
      formatId: 'opengd77',
      profileId: 'opengd77-1701',
      buildName: 'Test',
      channels: [{ entity: channel, wireName: channel.name }],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
  }

  function loadAssembled() {
    const yaml = readFileSync(join(fixtureDir, 'with-format-build.yaml'), 'utf8');
    const aggregate = parseProjectDocument(yaml);
    const build = aggregate.formatBuilds[0]!;
    const library = {
      channels: aggregate.channels,
      zones: aggregate.zones,
      talkGroups: aggregate.talkGroups,
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
      scanLists: [],
    };
    return assemble(build, library);
  }

  it('defaults analogue bandwidth to 12.5 kHz when unset', () => {
    const channel = {
      ...newChannel('proj', 'FM Default'),
      rxFrequency: 145_750_000,
      txFrequency: 145_150_000,
      modeProfiles: [
        {
          mode: 'fm' as const,
          squelch: null,
          rxTone: 'none' as const,
          txTone: 'none' as const,
          bandwidthKHz: null,
        },
      ],
    };
    const csv = serialiseChannels(minimalAssembled(channel));
    expect(bandwidthForChannel(csv, 'FM Default')).toBe('12.5');
  });

  it('exports explicit analogue bandwidth unchanged', () => {
    const channel = {
      ...newChannel('proj', 'FM Wide'),
      rxFrequency: 145_750_000,
      txFrequency: 145_150_000,
      modeProfiles: [
        {
          mode: 'fm' as const,
          squelch: null,
          rxTone: 'none' as const,
          txTone: 'none' as const,
          bandwidthKHz: 25,
        },
      ],
    };
    const csv = serialiseChannels(minimalAssembled(channel));
    expect(bandwidthForChannel(csv, 'FM Wide')).toBe('25');
  });

  it('leaves bandwidth empty for digital-only rows', () => {
    const channel = {
      ...newChannel('proj', 'DMR Only'),
      rxFrequency: 430_850_000,
      txFrequency: 438_450_000,
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 1,
          timeslot: 1 as const,
          dmrId: 123,
          contactRef: null,
          rxGroupListId: null,
        },
      ],
    };
    const csv = serialiseChannels(minimalAssembled(channel));
    expect(bandwidthForChannel(csv, 'DMR Only')).toBe('');
  });

  it('maps forbidTransmit to Rx Only column', () => {
    const channel = {
      ...newChannel('proj', 'RX Only Site'),
      rxFrequency: 145_750_000,
      txFrequency: 145_150_000,
      forbidTransmit: true,
      modeProfiles: [
        {
          mode: 'fm' as const,
          squelch: null,
          rxTone: 'none' as const,
          txTone: 'none' as const,
          bandwidthKHz: null,
        },
      ],
    };
    const csv = serialiseChannels(minimalAssembled(channel));
    const rows = parseCsv(csv);
    const headers = rows[0]!;
    const rxOnlyIndex = headers.indexOf(CHANNEL_COL.rxOnly);
    const nameIndex = headers.indexOf(CHANNEL_COL.name);
    const dataRow = rows.slice(1).find((row) => row[nameIndex] === 'RX Only Site');
    expect(dataRow?.[rxOnlyIndex]).toBe('Yes');
  });

  it('serialises channel wire names from assemble projection', () => {
    const assembled = loadAssembled();
    const csv = serialiseChannels(assembled);
    expect(csv).toContain('GB3DA Demo');
    expect(csv).toContain('GB7GL Scot');
    expect(csv).toContain('Channel Name');
    expect(csv).toContain('Analogue');
    expect(csv).toContain('Digital');
  });

  it('serialises zone members using build wire names', () => {
    const assembled = loadAssembled();
    const csv = serialiseZones(assembled);
    expect(csv).toContain('Edinburgh');
    expect(csv).toContain('GB3DA Demo');
  });

  it('flattens nested zones and omits nested-only rows in Zones.csv', () => {
    const aggregate = glasgowPmrNestedAggregate();
    const library = {
      channels: aggregate.channels,
      zones: aggregate.zones,
      talkGroups: aggregate.talkGroups,
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
      scanLists: [],
    };
    const build = {
      ...newFormatBuild(FIXTURE_PROJECT_ID, 'opengd77-1701', 'Nested export'),
      formatId: 'opengd77',
      layout: {
        sections: [
          {
            kind: 'zoneGrouping' as const,
            zones: [
              {
                id: FIXTURE_PARENT_ZONE_ID,
                name: 'Glasgow',
                channelIds: [FIXTURE_CHANNEL_B_ID],
              },
              {
                id: FIXTURE_CHILD_ZONE_ID,
                name: 'PMR446',
                channelIds: [FIXTURE_CHANNEL_A_ID],
              },
            ],
          },
        ],
      },
    };
    const assembled = assemble(build, library);
    const csv = serialiseZones(assembled);
    const rows = parseCsv(csv);
    const zoneNames = rows
      .slice(1)
      .map((row) => row[0])
      .filter(Boolean);
    expect(zoneNames).toEqual(['Glasgow']);
    const glasgowRow = rows.slice(1).find((row) => row[0] === 'Glasgow');
    expect(glasgowRow?.[1]).toBe('GB7GL DMR Scot');
    expect(glasgowRow?.[2]).toBe('GB3DA GB3DA Demo');
  });

  it('exportBuildAll returns all six CPS files', () => {
    const yaml = readFileSync(join(fixtureDir, 'with-format-build.yaml'), 'utf8');
    const aggregate = parseProjectDocument(yaml);
    const build = aggregate.formatBuilds[0]!;
    const library = {
      channels: aggregate.channels,
      zones: aggregate.zones,
      talkGroups: aggregate.talkGroups,
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
      scanLists: [],
    };

    const result = exportBuildAll({ build, library });
    expect(Object.keys(result.files)).toEqual([
      'Channels.csv',
      'Zones.csv',
      'Contacts.csv',
      'TG_Lists.csv',
      'DTMF.csv',
      'APRS.csv',
    ]);
    expect(result.files['Channels.csv']).toContain('GB3DA Demo');
    expect(result.files['Contacts.csv']).toContain('Scotland');
    expect(result.files['TG_Lists.csv']).toContain('Scotland TG');
  });

  it('export warnings surface long wire names', () => {
    const assembled = loadAssembled();
    const longName = 'ThisNameIsWayTooLong';
    assembled.channels[0] = {
      ...assembled.channels[0]!,
      wireName: longName,
      wireNameOverride: longName,
      entity: { ...assembled.channels[0]!.entity, name: longName },
    };
    const warnings = collectOpenGd77ExportWarnings(assembled);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.includes('exported as'))).toBe(true);
  });

  it('channels CSV is self-consistent when re-exported from same projection', () => {
    const assembled = loadAssembled();
    const first = serialiseChannels(assembled);
    const second = serialiseChannels(assembled);
    const comparison = compareCsvRecords(first, second, { nameColumn: 'Channel Name' });
    expect(comparison.ok).toBe(true);
  });

  it('shortens long talk group names in Contacts.csv when shortenNames is enabled', () => {
    const tg = {
      ...newTalkGroup('proj', 'Scotland West Region', 23559),
      abbreviation: 'Scot West',
    };
    const assembled: AssembledBuild = {
      buildId: 'build-1',
      formatId: 'opengd77',
      profileId: 'opengd77-1701',
      buildName: 'Test',
      channels: [],
      zones: [],
      talkGroups: [{ entity: tg, wireName: tg.name }],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };
    const files = serialiseOpenGd77Files(assembled, {
      profileId: 'opengd77-1701',
      shortenNames: true,
    });
    const rows = parseCsv(files['Contacts.csv']);
    const headers = rows[0]!;
    const nameIndex = headers.indexOf(CONTACT_COL.name);
    const dataRow = rows.slice(1).find((row) => row[nameIndex] === 'Scot West');
    expect(dataRow).toBeDefined();
    expect(dataRow?.[nameIndex]).toBe('Scot West');
  });

  it('shortens long zone, RX group list, and contact names when shortenNames is enabled', () => {
    const longZoneName = 'GLA GLASGOW TOWER ZONE NAME';
    const longRglName = 'Scotland West Receive Group List';
    const longContactName = 'Very Long Digital Contact Name';
    const zone = newZone('proj', longZoneName);
    const rgl = newRxGroupList('proj', longRglName);
    const contact = newDigitalContact('proj', longContactName, 1234567);
    const assembled: AssembledBuild = {
      buildId: 'build-1',
      formatId: 'opengd77',
      profileId: 'opengd77-1701',
      buildName: 'Test',
      channels: [],
      zones: [{ zoneId: zone.id, wireName: longZoneName, memberChannelIds: [] }],
      talkGroups: [],
      digitalContacts: [{ entity: contact, wireName: longContactName }],
      analogContacts: [],
      rxGroupLists: [{ entity: rgl, wireName: longRglName }],
      scanLists: [],
    };
    const files = serialiseOpenGd77Files(assembled, {
      profileId: 'opengd77-1701',
      shortenNames: true,
    });
    const zoneRows = parseCsv(files['Zones.csv']);
    const zoneName = zoneRows[1]?.[0];
    expect(zoneName).toBeDefined();
    expect(zoneName!.length).toBeLessThanOrEqual(16);

    const rglRows = parseCsv(files['TG_Lists.csv']);
    const rglNameIndex = rglRows[0]!.indexOf(RX_GROUP_LIST_COL.name);
    const rglName = rglRows[1]?.[rglNameIndex];
    expect(rglName).toBeDefined();
    expect(rglName!.length).toBeLessThanOrEqual(16);

    const contactRows = parseCsv(files['Contacts.csv']);
    const contactNameIndex = contactRows[0]!.indexOf(CONTACT_COL.name);
    const privateContact = contactRows
      .slice(1)
      .find((row) => row[contactRows[0]!.indexOf(CONTACT_COL.idType)] === 'Private');
    expect(privateContact?.[contactNameIndex]?.length).toBeLessThanOrEqual(16);
  });

  it('expands multi-mode channels into -F and -D wire rows when expandModes is true', () => {
    const yaml = readFileSync(join(fixtureDir, 'with-format-build.yaml'), 'utf8');
    const aggregate = parseProjectDocument(yaml);
    const build = aggregate.formatBuilds[0]!;
    const channels: Channel[] = aggregate.channels.map((channel, index) =>
      index === 1
        ? {
            ...channel,
            modeProfiles: [
              {
                mode: 'fm' as const,
                squelch: 50,
                rxTone: 'none' as const,
                txTone: 'none' as const,
                bandwidthKHz: 12.5,
              },
              {
                mode: 'dmr' as const,
                colourCode: 1,
                timeslot: 2 as const,
                dmrId: 123,
                contactRef: null,
                rxGroupListId: null,
              },
            ],
          }
        : channel,
    );
    const library = {
      channels,
      zones: aggregate.zones,
      talkGroups: aggregate.talkGroups,
      digitalContacts: aggregate.digitalContacts,
      analogContacts: aggregate.analogContacts,
      rxGroupLists: aggregate.rxGroupLists,
      scanLists: [],
    };
    const assembled = assemble(build, library);
    const csv = serialiseChannels(assembled, { profileId: build.profileId, expandModes: true });
    expect(csv).toContain('-F');
    expect(csv).toContain('-D');
  });
});
