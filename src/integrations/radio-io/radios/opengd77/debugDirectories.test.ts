import { describe, expect, it } from 'vitest';
import { OPENGD77_FAMILY_LIMITS } from '@core/radios/opengd77/limits.ts';
import {
  handBuiltContactRecord,
  handBuiltUserDatabaseEntry,
  putContactRecord,
  syntheticDirectoryArchive,
  syntheticUserDatabaseRegion,
} from './__fixtures__/directories.ts';
import { OPENGD77_BACKUP_FLASH_SPANS } from './backupRestoreRoles.ts';
import { encodeContactsIntoImage } from './contactCodec.ts';
import { OPENUV380_OFFSET } from './constants.ts';
import {
  findOpenGd77UserDatabaseEntries,
  projectOpenGd77Contacts,
  projectOpenGd77RxGroups,
  projectOpenGd77UserDatabase,
  type OpenGd77UserDatabaseOk,
} from './debugDirectories.ts';
import { createOpenUv380Image } from './memory.ts';
import { encodeRxGroupsIntoImage } from './rxGroupCodec.ts';
import { decodeOpenGd77UserDatabase, encodeUserDatabaseHeader } from './userDatabaseCodec.ts';

type Archive = ReturnType<typeof syntheticDirectoryArchive>;

const without = (a: Archive, id: string): Archive => ({
  manifest: { ...a.manifest, regions: a.manifest.regions.filter((r) => r.id !== id) },
  regions: Object.fromEntries(Object.entries(a.regions).filter(([k]) => k !== id)),
});

/** The span holding the contact bank, so a test can drop it. */
const spanIdAt = (abs: number) =>
  OPENGD77_BACKUP_FLASH_SPANS.find((s) => abs >= s.start && abs < s.start + s.length)!.id;

function directoryImage() {
  const image = createOpenUv380Image();
  encodeContactsIntoImage(image, [
    { index: 1, wireName: 'TEST TG', digitalId: 9_999_999, callType: 0 },
    { index: 3, wireName: 'TEST PRIV', digitalId: 1_234_567, callType: 1 },
  ]);
  putContactRecord(image, 5, handBuiltContactRecord('HAND', '9999998', 2, 0x02));
  putContactRecord(image, 7, handBuiltContactRecord('ODD', '55', 9, 0x07));
  encodeRxGroupsIntoImage(
    image,
    [{ index: 2, wireName: 'GROUP', memberDigitalIds: [9_999_999, 1_234_567] }],
    new Map([
      [9_999_999, 1],
      [1_234_567, 3],
    ]),
  );
  return image;
}

describe('projectOpenGd77Contacts', () => {
  it('lists occupied slots one-based with call type labels, Unknown kept raw', () => {
    const p = projectOpenGd77Contacts(syntheticDirectoryArchive(directoryImage()));
    expect(p.status).toBe('captured');
    expect(p.capacity).toBe(1024);
    expect(p.entries.map((e) => e.slot)).toEqual([1, 3, 5, 7]);
    expect(p.entries[0]).toMatchObject({ name: 'TEST TG', callTypeLabel: 'Group', callType: 0 });
    expect(p.entries[1]).toMatchObject({ digitalId: 1_234_567, callTypeLabel: 'Private' });
    expect(p.entries[2]).toMatchObject({
      name: 'HAND',
      digitalId: 9_999_998,
      callTypeLabel: 'All call',
      timeSlotByte: 0x02,
    });
    expect(p.entries[3]).toMatchObject({ callType: 9, callTypeLabel: 'Unknown', timeSlotByte: 7 });
  });

  it('is not captured, with no rows, when any of the bank is missing', () => {
    const a = syntheticDirectoryArchive(directoryImage());
    const p = projectOpenGd77Contacts(without(a, spanIdAt(OPENUV380_OFFSET.contacts)));
    expect(p).toEqual({ status: 'not-captured', entries: [], capacity: 1024 });
  });
});

describe('projectOpenGd77RxGroups', () => {
  it('resolves members to contact slots and DMR IDs', () => {
    const p = projectOpenGd77RxGroups(syntheticDirectoryArchive(directoryImage()));
    expect(p.status).toBe('captured');
    expect(p.entries).toHaveLength(1);
    expect(p.entries[0]).toMatchObject({
      slot: 2,
      name: 'GROUP',
      declaredMembers: 2,
      unresolved: 0,
      contactsCaptured: true,
      resolvedMembers: [
        { contactSlot: 1, digitalId: 9_999_999 },
        { contactSlot: 3, digitalId: 1_234_567 },
      ],
    });
  });

  it('counts a member whose contact slot is empty as unresolved', () => {
    const image = directoryImage();
    putContactRecord(image, 3, new Uint8Array(24).fill(0xff));
    const g = projectOpenGd77RxGroups(syntheticDirectoryArchive(image)).entries[0]!;
    expect(g.declaredMembers).toBe(2);
    expect(g.resolvedMembers).toHaveLength(1);
    expect(g.unresolved).toBe(1);
    expect(g.contactsCaptured).toBe(true);
  });

  it('reads every member as unresolved when the contact bank is not captured', () => {
    const a = syntheticDirectoryArchive(directoryImage());
    const g = projectOpenGd77RxGroups(without(a, spanIdAt(OPENUV380_OFFSET.contacts)));
    // The contact bank and the group bank may share a span; only assert when the group stays.
    if (g.status === 'captured') {
      expect(g.entries[0]).toMatchObject({
        resolvedMembers: [],
        unresolved: 2,
        contactsCaptured: false,
      });
    } else {
      expect(g.entries).toEqual([]);
    }
  });

  it('is not captured when the group bank is missing', () => {
    const a = syntheticDirectoryArchive(directoryImage());
    const p = projectOpenGd77RxGroups(without(a, spanIdAt(OPENUV380_OFFSET.groupLists)));
    expect(p.status).toBe('not-captured');
    expect(p.entries).toEqual([]);
  });
});

const ok = (a: Archive): OpenGd77UserDatabaseOk => {
  const p = projectOpenGd77UserDatabase(a);
  if (p.status !== 'ok') throw new Error(`status ${p.status}`);
  return p;
};
const withUd = (bytes: Uint8Array) => syntheticDirectoryArchive(undefined, bytes);

describe('projectOpenGd77UserDatabase', () => {
  it('reads absent as not captured', () => {
    expect(
      projectOpenGd77UserDatabase(without(withUd(new Uint8Array(12)), 'user-database')),
    ).toEqual({ status: 'not-captured' });
  });

  it('refuses a wrong address, role, path or length with a reason', () => {
    const a = withUd(syntheticUserDatabaseRegion(2));
    const mutate = (m: (r: Archive['manifest']['regions'][number]) => void): Archive => ({
      ...a,
      manifest: {
        ...a.manifest,
        regions: a.manifest.regions.map((r) => {
          const c = { ...r };
          if (r.id === 'user-database') m(c);
          return c;
        }),
      },
    });
    for (const m of [
      (r: { address: number }) => (r.address += 1),
      (r: { restoreRole: string }) => (r.restoreRole = 'restorable'),
      (r: { path: string }) => (r.path = 'regions/other.bin'),
      (r: { byteLength: number }) => (r.byteLength += 1),
    ]) {
      const p = projectOpenGd77UserDatabase(mutate(m as never));
      expect(p.status).toBe('refused');
      expect('reason' in p && p.reason.length).toBeGreaterThan(0);
    }
    const short = mutate((r) => (r.byteLength = 8));
    short.regions['user-database'] = a.regions['user-database']!.subarray(0, 8);
    expect(projectOpenGd77UserDatabase(short).status).toBe('refused');
  });

  it('reports a 12-byte invalid header with its raw hex and no entries', () => {
    const bad = new Uint8Array(12).fill(0xff);
    const p = projectOpenGd77UserDatabase(withUd(bad));
    expect(p).toMatchObject({ status: 'invalid-header', headerHex: 'ff '.repeat(11) + 'ff' });
    const wrongSize = encodeUserDatabaseHeader(1, 0x20 as never);
    expect(projectOpenGd77UserDatabase(withUd(wrongSize)).status).toBe('invalid-header');
  });

  it('reads a count of 0 as valid and empty', () => {
    const p = ok(withUd(encodeUserDatabaseHeader(0)));
    expect(p).toMatchObject({ headerEntryCount: 0, capturedEntries: 0, truncated: false });
  });

  it('reports a header count above the captured bytes as truncated', () => {
    const region = syntheticUserDatabaseRegion(3);
    region.set(encodeUserDatabaseHeader(50));
    const p = ok(withUd(region));
    expect(p).toMatchObject({ headerEntryCount: 50, capturedEntries: 3, truncated: true });
    expect(p.beyondProductMax).toBe(false);
  });

  it('reports a header count above USER_DATABASE_MAX as capped', () => {
    const region = syntheticUserDatabaseRegion(2);
    region.set(encodeUserDatabaseHeader(OPENGD77_FAMILY_LIMITS.USER_DATABASE_MAX + 5));
    const p = ok(withUd(region));
    expect(p.beyondProductMax).toBe(true);
    expect(p.truncated).toBe(true);
    expect(p.capturedEntries).toBe(2);
  });

  it('decodes a hand-built entry from the documented offsets', () => {
    const region = new Uint8Array(12 + 27);
    region.set(encodeUserDatabaseHeader(1));
    region.set(handBuiltUserDatabaseEntry(), 12);
    expect(ok(withUd(region)).entryAt(0)).toEqual({
      digitalId: 9_999_999,
      text: 'TEST',
      flashAddress: 0x0005000c,
      packedOffset: 12,
    });
  });

  it('gives true flash addresses across the segment boundary and matches the product decoder', () => {
    const count = 9_710;
    const region = syntheticUserDatabaseRegion(count);
    const p = ok(withUd(region));
    expect(p).toMatchObject({ capturedEntries: count, segment0Entries: 9_708, segment1Entries: 2 });
    expect(p.entryAt(0).flashAddress).toBe(0x0005000c);
    expect(p.entryAt(9_707).flashAddress).toBe(0x0005000c + 9_707 * 27);
    expect(p.entryAt(9_708).flashAddress).toBe(0x000d8000);
    expect(p.entryAt(9_709).flashAddress).toBe(0x000d8000 + 27);
    expect(p.entryAt(9_708).packedOffset).toBe(12 + 9_708 * 27);
    const n0 = 9_708 * 27;
    const all = decodeOpenGd77UserDatabase(
      region.subarray(0, 12),
      region.subarray(12, 12 + n0),
      region.subarray(12 + n0),
    );
    for (const i of [0, 1, 9_707, 9_708, 9_709]) expect(p.entryAt(i)).toMatchObject(all[i]!);
    expect(() => p.entryAt(count)).toThrow(RangeError);
  });

  it('moves segment 1 under the voice prompts for the lower-case n mode', () => {
    const region = syntheticUserDatabaseRegion(9_709);
    region[2] = 0x6e;
    expect(ok(withUd(region)).entryAt(9_708).flashAddress).toBe(0x000af400);
  });
});

describe('findOpenGd77UserDatabaseEntries', () => {
  const region = syntheticUserDatabaseRegion(300, (i) => (i % 2 ? `ODD ${i}` : `EVEN ${i}`));
  const p = ok(withUd(region));

  it('finds ID prefixes without decoding text', () => {
    const spy = { calls: 0 };
    const counting = {
      ...p,
      entryAt: (i: number) => {
        spy.calls++;
        return p.entryAt(i);
      },
    };
    expect(
      findOpenGd77UserDatabaseEntries(counting, { kind: 'id-prefix', value: '1000001' }, 200),
    ).toEqual({ indices: [0], capped: false });
    expect(spy.calls).toBe(0);
    const many = findOpenGd77UserDatabaseEntries(p, { kind: 'id-prefix', value: '1000' }, 10);
    expect(many.indices).toHaveLength(10);
    expect(many.capped).toBe(true);
  });

  it('searches text and stops at the limit', () => {
    const r = findOpenGd77UserDatabaseEntries(p, { kind: 'text', value: 'odd' }, 200);
    expect(r.indices).toHaveLength(150);
    expect(r.capped).toBe(false);
    const capped = findOpenGd77UserDatabaseEntries(p, { kind: 'text', value: 'even' }, 20);
    expect(capped).toMatchObject({ capped: true });
    expect(capped.indices).toHaveLength(20);
  });

  it('returns nothing for an empty query or no match', () => {
    expect(findOpenGd77UserDatabaseEntries(p, { kind: 'text', value: ' ' }, 5)).toEqual({
      indices: [],
      capped: false,
    });
    expect(findOpenGd77UserDatabaseEntries(p, { kind: 'text', value: 'zzz' }, 5).indices).toEqual(
      [],
    );
  });
});
