import { stringify } from 'yaml';
import { describe, expect, it } from 'vitest';
import { newChannel, newOwnDigitalId } from '@core/domain/factories.ts';
import { documentFromAggregate } from '../../projectDocument.ts';
import { parseProjectDocument } from './parse.ts';
import { serialiseProject } from './serialise.ts';
import { FIXTURE_PROJECT_ID, minimalProjectAggregate } from './testFixtures.ts';

const channel = {
  ...newChannel(FIXTURE_PROJECT_ID, 'Reflector'),
  callsign: 'GB7ABC',
  primaryMode: 'm17' as const,
};
const operator = {
  ...newOwnDigitalId(FIXTURE_PROJECT_ID, 'm17', 'Home', 'AB1CD/P'),
  isDefault: true,
};
const defaults = { mode: 'm17', can: null, playEveryCan: null, destination: '' } as const;

function m17Yaml(
  profile: Record<string, unknown>,
  identities: object[] = [operator],
  studioSchemaVersion = 31,
): string {
  const document = documentFromAggregate(minimalProjectAggregate());
  return stringify({
    ...document,
    studioSchemaVersion,
    library: {
      ...document.library,
      channels: [{ ...channel, modeProfiles: [profile] }],
      ownDigitalIds: identities,
    },
  });
}

describe('native YAML M17', () => {
  it('round-trips a typed M17 profile and a radio-wide identity', () => {
    const profile = { ...defaults, can: 3, playEveryCan: true, destination: 'M17-M17 A' };
    const yaml = serialiseProject({
      ...minimalProjectAggregate(),
      channels: [{ ...channel, modeProfiles: [profile] }],
      ownDigitalIds: [operator],
    });
    expect(yaml).toContain('studioSchemaVersion: 31');
    const parsed = parseProjectDocument(yaml);
    expect(parsed.channels[0]).toMatchObject({
      callsign: 'GB7ABC',
      primaryMode: 'm17',
      modeProfiles: [profile],
    });
    expect(parsed.ownDigitalIds).toEqual([operator]);
  });

  it('loads an active schema-30 stub with defaults', () => {
    const loaded = parseProjectDocument(m17Yaml({ mode: 'm17' }, [], 30));
    expect(loaded.channels[0]?.modeProfiles).toEqual([defaults]);
  });

  it('canonicalizes typed addresses and keeps an explicit false', () => {
    const loaded = parseProjectDocument(
      m17Yaml({ mode: 'm17', can: 15, playEveryCan: false, destination: ' @all ' }, [
        { ...operator, callsign: ' ab1cd/p ' },
      ]),
    );
    expect(loaded.channels[0]?.modeProfiles).toEqual([
      { ...defaults, can: 15, playEveryCan: false },
    ]);
    expect(loaded.ownDigitalIds).toEqual([operator]);
  });

  it.each([
    [{ can: -1 }, /\.can/],
    [{ can: 16 }, /\.can/],
    [{ can: 1.5 }, /\.can/],
    [{ can: '3' }, /\.can/],
    [{ playEveryCan: 'false' }, /\.playEveryCan/],
    [{ destination: 123 }, /\.destination/],
    [{ destination: 'AB*CD' }, /\.destination/],
  ])('rejects an invalid mode field %j', (fields, error) => {
    expect(() => parseProjectDocument(m17Yaml({ ...defaults, ...fields }))).toThrow(error);
  });

  it.each(['AB CD', '', 'ſ', 123])('rejects invalid operator callsign %j', (callsign) => {
    expect(() => parseProjectDocument(m17Yaml(defaults, [{ ...operator, callsign }]))).toThrow(
      /\.callsign/,
    );
  });

  it('rejects duplicate callsigns after canonicalization', () => {
    const duplicate = {
      ...newOwnDigitalId(FIXTURE_PROJECT_ID, 'm17'),
      callsign: ' ab1cd/p ',
    };
    expect(() => parseProjectDocument(m17Yaml(defaults, [operator, duplicate]))).toThrow(
      /more than once/,
    );
  });

  it('rejects several M17 defaults', () => {
    const duplicate = {
      ...newOwnDigitalId(FIXTURE_PROJECT_ID, 'm17', 'Club', 'AB2CD'),
      isDefault: true,
    };
    expect(() => parseProjectDocument(m17Yaml(defaults, [operator, duplicate]))).toThrow(
      /more than one default M17/,
    );
  });
});
