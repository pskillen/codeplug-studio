import { describe, expect, it } from 'vitest';
import type { OwnDigitalId } from '../models/library.ts';
import {
  channelOwnIdOverride,
  defaultOwnDigitalId,
  migrateLegacyOwnIds,
  newOwnDigitalIdIsDefault,
  ownDigitalIdLabel,
  ownDigitalIdOptionLabel,
  ownDigitalIdWarnings,
  protocolsWithoutDefault,
  resolveChannelOwnId,
  validateOwnDigitalId,
} from './ownDigitalIds.ts';

function row(over: Partial<OwnDigitalId> & Pick<OwnDigitalId, 'id'>): OwnDigitalId {
  return {
    projectId: 'p1',
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: '',
    protocol: 'dmr',
    number: 1234567,
    isDefault: false,
    ...over,
  };
}

describe('validateOwnDigitalId', () => {
  const none: OwnDigitalId[] = [];

  it('accepts the ends of the DMR range and refuses outside it', () => {
    expect(validateOwnDigitalId({ id: 'a', protocol: 'dmr', number: 1 }, none)).toEqual([]);
    expect(validateOwnDigitalId({ id: 'a', protocol: 'dmr', number: 16_776_415 }, none)).toEqual(
      [],
    );
    expect(validateOwnDigitalId({ id: 'a', protocol: 'dmr', number: 0 }, none)).toHaveLength(1);
    expect(validateOwnDigitalId({ id: 'a', protocol: 'dmr', number: 16_776_416 }, none)).toEqual([
      'DMR IDs are 1–16776415',
    ]);
  });

  it('accepts the ends of the NXDN range and refuses outside it', () => {
    expect(validateOwnDigitalId({ id: 'a', protocol: 'nxdn', number: 65519 }, none)).toEqual([]);
    // 65535 is the all-call group ID: fine for a talk group, never an own ID.
    expect(validateOwnDigitalId({ id: 'a', protocol: 'nxdn', number: 65535 }, none)).toHaveLength(
      1,
    );
    expect(validateOwnDigitalId({ id: 'a', protocol: 'nxdn', number: 65520 }, none)).toEqual([
      'NXDN IDs are 1–65519',
    ]);
    expect(validateOwnDigitalId({ id: 'a', protocol: 'nxdn', number: 1.5 }, none)).toHaveLength(1);
  });

  it('refuses the same number twice in a protocol but allows it across protocols', () => {
    const all = [row({ id: 'x', protocol: 'dmr', number: 1234 })];
    expect(validateOwnDigitalId({ id: 'y', protocol: 'dmr', number: 1234 }, all)).toEqual([
      'DMR ID 1234 is already in Digital IDs',
    ]);
    expect(validateOwnDigitalId({ id: 'y', protocol: 'nxdn', number: 1234 }, all)).toEqual([]);
    // Editing the row itself is not a duplicate.
    expect(validateOwnDigitalId({ id: 'x', protocol: 'dmr', number: 1234 }, all)).toEqual([]);
  });

  it('refuses an unknown protocol', () => {
    expect(
      validateOwnDigitalId(
        { id: 'a', protocol: 'p25' as unknown as OwnDigitalId['protocol'], number: 1 },
        none,
      ),
    ).toEqual(['Protocol must be DMR or NXDN']);
  });
});

describe('defaultOwnDigitalId', () => {
  it('is null with no rows and with no default', () => {
    expect(defaultOwnDigitalId([], 'dmr')).toBeNull();
    expect(defaultOwnDigitalId([row({ id: 'a' })], 'dmr')).toBeNull();
  });

  it('returns the default of the asked protocol only', () => {
    const all = [
      row({ id: 'a', protocol: 'dmr', isDefault: true }),
      row({ id: 'b', protocol: 'nxdn', number: 5, isDefault: true }),
    ];
    expect(defaultOwnDigitalId(all, 'dmr')?.id).toBe('a');
    expect(defaultOwnDigitalId(all, 'nxdn')?.id).toBe('b');
  });

  it('picks the smallest id when two rows are marked, whatever the order', () => {
    const a = row({ id: 'a', number: 1, isDefault: true });
    const b = row({ id: 'b', number: 2, isDefault: true });
    expect(defaultOwnDigitalId([b, a], 'dmr')?.id).toBe('a');
    expect(defaultOwnDigitalId([a, b], 'dmr')?.id).toBe('a');
    expect(ownDigitalIdWarnings([a, b])).toEqual([
      'More than one default DMR ID. Set one as the default to fix it.',
    ]);
  });
});

describe('default rules', () => {
  it('the first ID of a protocol is the default, later ones are not', () => {
    expect(newOwnDigitalIdIsDefault([], 'dmr')).toBe(true);
    const all = [row({ id: 'a', protocol: 'dmr' })];
    expect(newOwnDigitalIdIsDefault(all, 'dmr')).toBe(false);
    expect(newOwnDigitalIdIsDefault(all, 'nxdn')).toBe(true);
  });

  it('an out-of-range number (from an older project) is kept and reported, not refused', () => {
    const all = [
      row({ id: 'a', number: 1234567, isDefault: true }),
      row({ id: 'b', number: 99_999_999, name: 'Old' }),
    ];
    expect(ownDigitalIdWarnings(all)).toEqual([
      'Old is out of range (DMR IDs are 1–16776415). Open it and enter a valid number, or delete it.',
    ]);
    const migrated = migrateLegacyOwnIds(
      'p1',
      [{ modeProfiles: [{ mode: 'dmr', dmrId: 99_999_999 }] }],
      [],
      () => 'r',
    );
    expect(migrated.ownDigitalIds.map((r) => r.number)).toEqual([99_999_999]);
  });

  it('a protocol with IDs but no default is reported, an empty one is not', () => {
    const all = [row({ id: 'a', protocol: 'dmr' })];
    expect(protocolsWithoutDefault(all)).toEqual(['dmr']);
    expect(ownDigitalIdWarnings(all)).toEqual([
      'No default DMR ID. Channels set to Default use whatever DMR ID the radio already has, and some radios send none, until you choose one.',
    ]);
    expect(ownDigitalIdWarnings([row({ id: 'a', isDefault: true })])).toEqual([]);
    expect(ownDigitalIdWarnings([])).toEqual([]);
  });
});

describe('labels', () => {
  it('shows the name, else the protocol and number', () => {
    expect(ownDigitalIdLabel(row({ id: 'a', name: 'Home' }))).toBe('Home');
    expect(ownDigitalIdLabel(row({ id: 'a', name: '  ', number: 2351234 }))).toBe('DMR 2351234');
    expect(ownDigitalIdLabel(row({ id: 'a', protocol: 'nxdn', number: 1234 }))).toBe('NXDN 1234');
    expect(ownDigitalIdOptionLabel(row({ id: 'a', name: 'Home', number: 2351234 }))).toBe(
      'Home (2351234)',
    );
    expect(ownDigitalIdOptionLabel(row({ id: 'a', number: 2351234 }))).toBe('DMR 2351234');
  });
});

describe('resolveChannelOwnId', () => {
  const all = [
    row({ id: 'dmr-default', name: 'Home', number: 2351234, isDefault: true }),
    row({ id: 'dmr-other', name: 'Club', number: 2351235 }),
    row({ id: 'nxdn-default', protocol: 'nxdn', number: 1234, isDefault: true }),
  ];

  it('uses the named ID as an override', () => {
    const resolved = resolveChannelOwnId({ mode: 'dmr', ownDigitalIdId: 'dmr-other' }, all);
    expect(resolved?.row.id).toBe('dmr-other');
    expect(resolved?.source).toBe('override');
  });

  it('falls back to the protocol default when the profile names none', () => {
    const resolved = resolveChannelOwnId({ mode: 'dmr', ownDigitalIdId: null }, all);
    expect(resolved?.row.id).toBe('dmr-default');
    expect(resolved?.source).toBe('default');
    expect(resolveChannelOwnId({ mode: 'nxdn' }, all)?.row.id).toBe('nxdn-default');
  });

  it('ignores a choice of the other protocol or a missing row', () => {
    expect(resolveChannelOwnId({ mode: 'nxdn', ownDigitalIdId: 'dmr-other' }, all)?.row.id).toBe(
      'nxdn-default',
    );
    expect(resolveChannelOwnId({ mode: 'dmr', ownDigitalIdId: 'gone' }, all)?.row.id).toBe(
      'dmr-default',
    );
  });

  it('is null with no default and nothing chosen, and for modes without an own ID', () => {
    expect(resolveChannelOwnId({ mode: 'dmr' }, [row({ id: 'a' })])).toBeNull();
    expect(resolveChannelOwnId({ mode: 'fm' }, all)).toBeNull();
  });

  it('channelOwnIdOverride never returns the default', () => {
    expect(channelOwnIdOverride({ mode: 'dmr', ownDigitalIdId: null }, all)).toBeNull();
    expect(channelOwnIdOverride({ mode: 'dmr', ownDigitalIdId: 'dmr-default' }, all)?.id).toBe(
      'dmr-default',
    );
  });
});

describe('migrateLegacyOwnIds', () => {
  let counter = 0;
  const makeId = () => `row-${++counter}`;
  const dmr = (dmrId: number | null) => ({ mode: 'dmr', colourCode: 1, dmrId });
  const nxdn = (unitId: number | null) => ({ mode: 'nxdn', rxRan: 1, unitId });
  const channel = (id: string, ...modeProfiles: object[]) => ({ id, modeProfiles });

  it('turns two channels sharing a DMR ID into one row that both choose', () => {
    counter = 0;
    const result = migrateLegacyOwnIds(
      'p1',
      [channel('a', dmr(2351234)), channel('b', dmr(2351234)), channel('c', dmr(2351235))],
      [],
      makeId,
    );
    expect(
      result.ownDigitalIds.map((r) => [r.id, r.protocol, r.number, r.name, r.isDefault]),
    ).toEqual([
      ['row-1', 'dmr', 2351234, '', false],
      ['row-2', 'dmr', 2351235, '', false],
    ]);
    const choice = (index: number) =>
      (result.channels[index]!.modeProfiles[0] as { ownDigitalIdId: string }).ownDigitalIdId;
    expect(choice(0)).toBe('row-1');
    expect(choice(1)).toBe('row-1');
    expect(choice(2)).toBe('row-2');
    expect(result.channels[0]!.modeProfiles[0]).not.toHaveProperty('dmrId');
  });

  it('maps null and 0 to Default and creates no row', () => {
    counter = 0;
    const result = migrateLegacyOwnIds(
      'p1',
      [channel('a', dmr(null)), channel('b', dmr(0))],
      [],
      makeId,
    );
    expect(result.ownDigitalIds).toEqual([]);
    for (const ch of result.channels) {
      expect(ch.modeProfiles[0]).toMatchObject({ ownDigitalIdId: null });
      expect(ch.modeProfiles[0]).not.toHaveProperty('dmrId');
    }
  });

  it('migrates an NXDN unit ID to an NXDN row, apart from a DMR row with the same number', () => {
    counter = 0;
    const result = migrateLegacyOwnIds('p1', [channel('a', dmr(1234), nxdn(1234))], [], makeId);
    expect(result.ownDigitalIds.map((r) => [r.protocol, r.number])).toEqual([
      ['dmr', 1234],
      ['nxdn', 1234],
    ]);
    const [d, n] = result.channels[0]!.modeProfiles as { ownDigitalIdId: string }[];
    expect(d!.ownDigitalIdId).toBe('row-1');
    expect(n!.ownDigitalIdId).toBe('row-2');
    expect(n).not.toHaveProperty('unitId');
  });

  it('is idempotent: a second run changes nothing and returns the same channels', () => {
    counter = 0;
    const first = migrateLegacyOwnIds('p1', [channel('a', dmr(2351234))], [], makeId);
    const second = migrateLegacyOwnIds('p1', first.channels, first.ownDigitalIds, makeId);
    expect(second.ownDigitalIds).toEqual(first.ownDigitalIds);
    expect(second.channels[0]).toBe(first.channels[0]);
  });

  it('reuses an existing row with the same protocol and number, and never sets a default', () => {
    counter = 0;
    const existing = [row({ id: 'mine', name: 'Home', number: 2351234, isDefault: true })];
    const result = migrateLegacyOwnIds('p1', [channel('a', dmr(2351234))], existing, makeId);
    expect(result.ownDigitalIds).toEqual(existing);
    expect(result.channels[0]!.modeProfiles[0]).toMatchObject({ ownDigitalIdId: 'mine' });
  });

  it('does not set a default on the rows it creates', () => {
    counter = 0;
    const result = migrateLegacyOwnIds('p1', [channel('a', dmr(2351234), nxdn(5))], [], makeId);
    expect(result.ownDigitalIds.some((r) => r.isDefault)).toBe(false);
  });

  it('leaves analogue profiles and channels without a legacy key as they are', () => {
    const fm = { mode: 'fm' };
    const ch = channel('a', fm, { mode: 'dmr', ownDigitalIdId: 'x' });
    const result = migrateLegacyOwnIds('p1', [ch], [], makeId);
    expect(result.channels[0]).toBe(ch);
  });
});
