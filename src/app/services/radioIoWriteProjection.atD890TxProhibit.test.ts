import { describe, expect, it } from 'vitest';
import { newChannel, newRadioBuildForProfile } from '@core/domain/factories.ts';
import { withExportEligibleDefaults } from '@core/domain/channelTestHelpers.ts';
import type { Channel } from '@core/models/library.ts';
import type { BuildExportSettings } from '@core/models/radioBuild.ts';
import { assemble, type LibrarySlice } from '@core/services/assemble.ts';
import { encodeAtD890ChannelRecord } from '@integrations/radio-io/radios/at-d890uv/channelCodec.ts';
import { buildRadioWriteProjection } from './radioIoWriteProjection.ts';

function dualModeChannel(primaryMode: 'fm' | 'dmr', forbidTransmit: Channel['forbidTransmit']) {
  return withExportEligibleDefaults({
    ...newChannel('p1', 'Fireground'),
    primaryMode,
    forbidTransmit,
    rxFrequency: 457_487_500,
    txFrequency: 457_487_500,
    modeProfiles: [
      { mode: 'fm', rxTone: 'none', txTone: 'none', squelch: null, bandwidthKHz: 12.5 },
      {
        mode: 'dmr',
        colourCode: 1,
        timeslot: 1,
        ownDigitalIdId: null,
        contactRef: null,
        rxGroupListId: null,
      },
    ],
  });
}

const policies: {
  name: string;
  forbidTransmit: Channel['forbidTransmit'];
  exportSettings?: BuildExportSettings;
  expected: boolean;
}[] = [
  { name: 'channel forbids TX', forbidTransmit: 'forbid', expected: true },
  { name: 'channel allows TX', forbidTransmit: 'allow', expected: false },
  {
    name: 'default inherits build forbid',
    forbidTransmit: 'default',
    exportSettings: { defaultForbidTransmit: 'forbid' },
    expected: true,
  },
  {
    name: 'build allow overrides channel forbid',
    forbidTransmit: 'forbid',
    exportSettings: { defaultForbidTransmit: 'allow' },
    expected: false,
  },
];

describe.each(['radio-io-at-d890uv', 'radio-io-at-d890uv-mm9pdy'])(
  '%s transmit prohibition from library to wire',
  (profileId) => {
    describe.each(['fm', 'dmr'] as const)('dual-mode primary %s', (primaryMode) => {
      it.each(policies)('$name', ({ forbidTransmit, exportSettings, expected }) => {
        const channel = dualModeChannel(primaryMode, forbidTransmit);
        const library: LibrarySlice = {
          channels: [channel],
          zones: [],
          scanLists: [],
          talkGroups: [],
          digitalContacts: [],
          analogContacts: [],
          rxGroupLists: [],
        };
        const pair = newRadioBuildForProfile('p1', profileId);
        const build = { ...pair.build, exportSettings };
        const egress = pair.egress;
        const assembled = assemble(build, library, {
          formatId: egress.formatId,
          profileId: egress.profileId,
        });
        const projection = buildRadioWriteProjection(assembled, build, library, egress);
        expect(projection.channels).toHaveLength(1);
        const dto = projection.channels[0]!;
        expect(dto.mode).toBe(primaryMode === 'fm' ? 'fixed-analog' : 'fixed-digital');
        expect(dto.rxOnly === true).toBe(expected);
        const bytes = encodeAtD890ChannelRecord(dto);
        expect(bytes[0x09]! & 0x20).toBe(expected ? 0x20 : 0);
        expect(bytes[0x34]! & 0x08).toBe(expected ? 0x08 : 0);
      });
    });
  },
);
