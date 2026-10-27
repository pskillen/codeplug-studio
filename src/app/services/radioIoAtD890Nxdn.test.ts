import { describe, expect, it } from 'vitest';
import { newChannel, newRadioBuildForProfile, newZone } from '@core/domain/factories.ts';
import { withExportEligibleDefaults } from '@core/domain/channelTestHelpers.ts';
import { formatExportWarning } from '@core/import-export/exportWarning.ts';
import type { Channel, ChannelModeProfile } from '@core/models/library.ts';
import { assemble, type LibrarySlice } from '@core/services/assemble.ts';
import { encodeAtD890ChannelRecord } from '@integrations/radio-io/radios/at-d890uv/channelCodec.ts';
import { buildRadioWriteProjection } from './radioIoWriteProjection.ts';

const PROJECT = 'p1';

const DMR: ChannelModeProfile = {
  mode: 'dmr',
  dmrMode: null,
  colourCode: 3,
  timeslot: 2,
  dmrId: null,
  contactRef: null,
  rxGroupListId: null,
  sendTalkerAlias: 'default',
};
const FM: ChannelModeProfile = {
  mode: 'fm',
  rxTone: 'none',
  txTone: 'none',
  squelch: null,
  bandwidthKHz: 12.5,
  analogSquelchMode: 'default',
};
function nxdn(over: Partial<Extract<ChannelModeProfile, { mode: 'nxdn' }>> = {}) {
  return {
    mode: 'nxdn' as const,
    rxRan: 7,
    txRan: 5,
    unitId: null,
    contactRef: null,
    rxGroupListId: null,
    nxdnRate: 'nxdn96' as const,
    ...over,
  };
}

function channel(id: string, rxHz: number, profiles: ChannelModeProfile[]): Channel {
  return withExportEligibleDefaults({
    ...newChannel(PROJECT, id),
    id,
    rxFrequency: rxHz,
    txFrequency: rxHz,
    modeProfiles: profiles,
  });
}

function libraryOf(channels: Channel[], zoneChannels: Channel[] = channels): LibrarySlice {
  const zone = {
    ...newZone(PROJECT, 'Z'),
    id: 'zone-z',
    members: zoneChannels.map((ch) => ({ kind: 'channel' as const, channelId: ch.id })),
  };
  return {
    channels,
    zones: [zone],
    scanLists: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    aprsConfiguration: null,
  };
}

/**
 * The same library with every NXDN profile removed and NXDN-only channels dropped from the channel
 * list: what the base wrote. The zone keeps every original member, so a dropped NXDN-only channel
 * stays in the zone's member list (as it would on the base) and the comparison covers that path.
 */
function withoutNxdn(library: LibrarySlice): LibrarySlice {
  const channels = library.channels
    .map((ch) => ({ ...ch, modeProfiles: ch.modeProfiles.filter((p) => p.mode !== 'nxdn') }))
    .filter((ch) => ch.modeProfiles.length > 0);
  const out = libraryOf(channels);
  return { ...out, zones: library.zones };
}

function project(
  profileId: 'radio-io-at-d890uv-mm9pdy' | 'radio-io-at-d890uv',
  library: LibrarySlice,
  atD890Nxdn?: boolean,
) {
  const { build, egress } = newRadioBuildForProfile(PROJECT, profileId);
  const assembled = assemble(build, library, {
    formatId: egress.formatId,
    profileId: egress.profileId,
  });
  return buildRadioWriteProjection(
    assembled,
    build,
    library,
    egress,
    atD890Nxdn === undefined ? undefined : { atD890Nxdn },
  );
}

const dmrNxdn = channel('dmr-nxdn', 430_125_000, [DMR, nxdn()]);
const nxdnOnly = channel('nxdn-only', 430_250_000, [nxdn({ rxRan: 12, txRan: 13 })]);
const fmNxdn = channel('fm-nxdn', 145_500_000, [FM, nxdn({ nxdnRate: 'nxdn48' })]);
const plainDmr = channel('plain-dmr', 430_375_000, [DMR]);
const library = libraryOf([dmrNxdn, nxdnOnly, fmNxdn, plainDmr]);

function byName(projection: ReturnType<typeof project>) {
  return new Map(projection.channels.map((ch) => [ch.wireName, ch]));
}

function warningText(projection: ReturnType<typeof project>): string {
  return projection.warnings.map((w) => formatExportWarning(w)).join('\n');
}

describe('AT-D890 MM9PDY NXDN channel projection', () => {
  describe('radio reports NXDN enabled', () => {
    const projection = project('radio-io-at-d890uv-mm9pdy', library, true);
    const channels = byName(projection);

    it('keeps the NXDN-only channel as a digital channel with NXDN fields', () => {
      const ch = channels.get('nxdn-only');
      expect(ch).toBeDefined();
      expect(ch!.mode).toBe('digital');
      expect(ch!.nxdn).toEqual({ rxRan: 12, txRan: 13, rate: 'nxdn96' });
      expect(ch!.colorCode).toBeUndefined();
      expect(ch!.txContactId).toBeUndefined();
    });

    it('gives a channel with DMR and NXDN profiles both field sets', () => {
      const ch = channels.get('dmr-nxdn');
      expect(ch!.mode).toBe('digital');
      expect(ch!.colorCode).toBe(3);
      expect(ch!.timeslot).toBe(2);
      expect(ch!.nxdn).toEqual({ rxRan: 7, txRan: 5, rate: 'nxdn96' });
    });

    it('writes an FM + NXDN channel as fixed-digital, like FM + DMR, with NXDN fields', () => {
      const ch = channels.get('fm-nxdn');
      expect(ch!.mode).toBe('fixed-digital');
      expect(ch!.nxdn).toEqual({ rxRan: 7, txRan: 5, rate: 'nxdn48' });
    });

    it('leaves channels with no NXDN profile without nxdn', () => {
      expect(channels.get('plain-dmr')!.nxdn).toBeUndefined();
    });

    it('warns about NXDN-only channels and about analogue + NXDN channels', () => {
      const text = warningText(projection);
      expect(text).toContain('1 channel(s) have NXDN settings only');
      expect(text).toContain('1 channel(s) have analogue and NXDN settings');
    });

    it('omits a RAN outside 0-63 with a warning instead of failing', () => {
      const bad = channel('bad-ran', 430_500_000, [DMR, nxdn({ rxRan: 99, txRan: 4 })]);
      const out = project('radio-io-at-d890uv-mm9pdy', libraryOf([bad]), true);
      expect(out.channels[0]!.nxdn).toEqual({ txRan: 4, rate: 'nxdn96' });
      expect(warningText(out)).toContain('1 NXDN RAN value(s) are outside 0-63');
    });

    it('encodes the RAN and rate into the channel record', () => {
      const dto = channels.get('dmr-nxdn')!;
      const record = encodeAtD890ChannelRecord(dto);
      expect(record[0x66]! & 1).toBe(1);
      expect(record[0x68]).toBe(5);
      expect(record[0x69]).toBe(7);
    });
  });

  describe('radio does not report NXDN enabled (gate off)', () => {
    const baseline = project('radio-io-at-d890uv-mm9pdy', withoutNxdn(library));

    for (const [label, flag] of [
      ['no context', undefined],
      ['explicitly false', false],
    ] as const) {
      it(`projects exactly what the base wrote (${label})`, () => {
        const off = project('radio-io-at-d890uv-mm9pdy', library, flag);
        expect(off.channels).toEqual(baseline.channels);
        expect(off.organisation).toEqual(baseline.organisation);
        expect([...off.numbersBySourceChannelId]).toEqual([...baseline.numbersBySourceChannelId]);
        expect(off.warnings).toEqual(baseline.warnings);
        for (const ch of off.channels) expect(ch.nxdn).toBeUndefined();
      });
    }

    it('drops the NXDN-only channel and treats FM + NXDN as plain FM', () => {
      const off = byName(project('radio-io-at-d890uv-mm9pdy', library));
      expect(off.has('nxdn-only')).toBe(false);
      expect(off.get('fm-nxdn')!.mode).toBe('analog');
      expect(off.get('dmr-nxdn')!.mode).toBe('digital');
    });

    it('encodes channel records byte for byte as without any NXDN profile', () => {
      const off = project('radio-io-at-d890uv-mm9pdy', library);
      const encodedOff = off.channels.map((ch) => [...encodeAtD890ChannelRecord(ch)]);
      const encodedBase = baseline.channels.map((ch) => [...encodeAtD890ChannelRecord(ch)]);
      expect(encodedOff).toEqual(encodedBase);
    });
  });

  describe('stock AT-D890UV target', () => {
    it('never sets nxdn, even if asked', () => {
      const withFlag = project('radio-io-at-d890uv', library, true);
      for (const ch of withFlag.channels) expect(ch.nxdn).toBeUndefined();
    });

    it('is byte-identical to a library without NXDN profiles', () => {
      const stock = project('radio-io-at-d890uv', library, true);
      const baseline = project('radio-io-at-d890uv', withoutNxdn(library));
      expect(stock.channels).toEqual(baseline.channels);
      expect(stock.organisation).toEqual(baseline.organisation);
    });

    it('does not write an NXDN-only channel (unsupported mode)', () => {
      const stock = byName(project('radio-io-at-d890uv', library, true));
      expect(stock.has('nxdn-only')).toBe(false);
    });
  });
});
