import { afterEach, describe, expect, it, vi } from 'vitest';
import { RepeaterDirectoryError } from './types.ts';
import {
  fetchDeviceTalkGroups,
  loadTalkGroupNameMap,
  resolveDeviceTalkGroups,
  resolveTalkGroupName,
} from './brandmeisterTalkGroups.ts';

const GB7AC_STATIC = [
  { talkgroup: '23559', slot: '1', repeaterid: '234054' },
  { talkgroup: '23551', slot: '2', repeaterid: '234054' },
  { talkgroup: '2355', slot: '2', repeaterid: '234054' },
  { talkgroup: '234140', slot: '2', repeaterid: '234054' },
];

function mockFetch(handlers: Record<string, { status: number; body: unknown }>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const path = url.replace('https://api.brandmeister.network/v2', '');
      const handler = handlers[path];
      if (!handler) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      return {
        ok: handler.status >= 200 && handler.status < 300,
        status: handler.status,
        json: async () => handler.body,
      };
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchDeviceTalkGroups', () => {
  it('returns static talk group rows', async () => {
    mockFetch({
      '/device/234054/talkgroup': { status: 200, body: GB7AC_STATIC },
    });
    const rows = await fetchDeviceTalkGroups('234054');
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({ talkgroup: '23559', slot: '1' });
  });

  it('throws RepeaterDirectoryError on HTTP failure', async () => {
    mockFetch({
      '/device/1/talkgroup': { status: 500, body: {} },
    });
    await expect(fetchDeviceTalkGroups('1')).rejects.toBeInstanceOf(RepeaterDirectoryError);
  });
});

describe('resolveTalkGroupName', () => {
  it('prefers detail endpoint name', async () => {
    mockFetch({
      '/talkgroup/23559': { status: 200, body: { ID: 23559, Name: 'Scotland West' } },
    });
    const name = await resolveTalkGroupName(23559, new Map());
    expect(name).toBe('Scotland West');
  });

  it('falls back to bulk map when detail 404s', async () => {
    mockFetch({
      '/talkgroup/2355': { status: 404, body: {} },
    });
    const name = await resolveTalkGroupName(2355, new Map([[2355, 'Scotland']]));
    expect(name).toBe('Scotland');
  });

  it('uses synthetic name when detail and map miss', async () => {
    mockFetch({
      '/talkgroup/234140': { status: 404, body: {} },
    });
    const name = await resolveTalkGroupName(234140, new Map());
    expect(name).toBe('TG 234140');
  });
});

describe('resolveDeviceTalkGroups', () => {
  it('maps slots and resolves mixed names', async () => {
    mockFetch({
      '/talkgroup/23559': { status: 200, body: { ID: 23559, Name: 'Scotland West' } },
      '/talkgroup/23551': { status: 404, body: {} },
      '/talkgroup/2355': { status: 200, body: { ID: 2355, Name: 'Scotland' } },
      '/talkgroup/234140': { status: 404, body: {} },
    });
    const nameMap = new Map<number, string>([[23551, 'UK TS2']]);
    const resolved = await resolveDeviceTalkGroups(GB7AC_STATIC, nameMap);
    expect(resolved).toEqual([
      { digitalId: 23559, name: 'Scotland West', slot: 1 },
      { digitalId: 23551, name: 'UK TS2', slot: 2 },
      { digitalId: 2355, name: 'Scotland', slot: 2 },
      { digitalId: 234140, name: 'TG 234140', slot: 2 },
    ]);
  });
});

describe('loadTalkGroupNameMap', () => {
  it('parses id to name entries', async () => {
    mockFetch({
      '/talkgroup': { status: 200, body: { '91': 'World-wide', '2355': 'Scotland' } },
    });
    const map = await loadTalkGroupNameMap();
    expect(map.get(91)).toBe('World-wide');
    expect(map.get(2355)).toBe('Scotland');
  });
});

describe('fetchResolvedDeviceTalkGroups', () => {
  it('chains device fetch with resolution', async () => {
    mockFetch({
      '/device/234054/talkgroup': { status: 200, body: GB7AC_STATIC.slice(0, 1) },
      '/talkgroup': { status: 200, body: {} },
      '/talkgroup/23559': { status: 200, body: { ID: 23559, Name: 'Scotland West' } },
    });
    const resolved = await resolveDeviceTalkGroups(
      await fetchDeviceTalkGroups('234054'),
      new Map(),
    );
    expect(resolved).toEqual([{ digitalId: 23559, name: 'Scotland West', slot: 1 }]);
  });
});
