import { describe, expect, it } from 'vitest';
import { validateZoneMembership } from './validation.ts';
import type { Library, Zone } from '@core/models/library.ts';

function zone(id: string, members: Zone['members']): Zone {
  return {
    id,
    projectId: 'p1',
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: id,
    members,
    comment: '',
  };
}

function lib(zones: Zone[]): Library {
  return {
    channels: [],
    analogContacts: [],
    talkGroups: [],
    digitalContacts: [],
    rxGroupLists: [],
    scanLists: [],
    zones,
  };
}

describe('validateZoneMembership', () => {
  it('rejects self-inclusion', () => {
    const a = zone('z-a', []);
    expect(() =>
      validateZoneMembership('z-a', [{ kind: 'zone', zoneId: 'z-a' }], lib([a])),
    ).toThrow(/cannot include itself/);
  });

  it('rejects cycles through existing child zones', () => {
    const a = zone('z-a', [{ kind: 'zone', zoneId: 'z-b' }]);
    const b = zone('z-b', [{ kind: 'zone', zoneId: 'z-a' }]);
    expect(() => validateZoneMembership('z-a', a.members, lib([a, b]))).toThrow(/cycle/);
  });
});
