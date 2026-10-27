import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  newAprsConfiguration,
  newChannel,
  newDigitalContact,
  newProjectMeta,
  newRadioBuildWithEgresses,
  newSatellite,
  newTalkGroup,
  newTrackingSettings,
} from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';
import type { Satellite } from '@core/models/satellite.ts';
import { IndexedDbProjectPersistence } from './indexedDb.ts';
import type { PersistenceChange } from './types.ts';

let counter = 0;
const open = new Set<IndexedDbProjectPersistence>();

function makeStore(): IndexedDbProjectPersistence {
  // Unique DB name per store keeps tests isolated under fake-indexeddb.
  const store = new IndexedDbProjectPersistence(`test-db-${counter++}`);
  open.add(store);
  return store;
}

afterEach(() => {
  for (const store of open) store.close();
  open.clear();
});

describe('IndexedDbProjectPersistence', () => {
  it('seeds and lists projects', async () => {
    const store = makeStore();
    await store.seedProject({ meta: newProjectMeta('North Wales') });

    const list = await store.listProjects();
    expect(list).toHaveLength(1);
    expect(list[0]?.name).toBe('North Wales');
  });

  it('persists channels and lists them sorted by name', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });

    await store.putChannel(newChannel(meta.projectId, 'Zulu'), null);
    await store.putChannel(newChannel(meta.projectId, 'Alpha'), null);

    const channels = await store.listChannels(meta.projectId);
    expect(channels.map((c) => c.name)).toEqual(['Alpha', 'Zulu']);
  });

  it('defaults scanInclusion when reading legacy channel rows', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const channel = newChannel(meta.projectId, 'Legacy');
    const { scanInclusion: _scanInclusion, ...legacyRow } = channel;
    void _scanInclusion;
    const legacyStoredRow: Omit<Channel, 'scanInclusion'> & { scanSkip: boolean } = {
      ...legacyRow,
      scanSkip: true,
    };
    await store.seedProject({
      meta,
      // Pre-schema-v8 rows persisted without scanInclusion.
      channels: [legacyStoredRow as unknown as Channel],
    });

    const loaded = await store.getChannel(meta.projectId, channel.id);
    expect(loaded?.scanInclusion).toBe('skip');
    expect(loaded).not.toHaveProperty('scanSkip');
  });

  it('synthesizes transmitters when reading pre-v26 legacy satellite rows', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const satellite = newSatellite(meta.projectId, 'ISS', 25544);
    const { transmitters: _transmitters, ...legacyRow } = satellite;
    void _transmitters;
    const legacyStoredRow = {
      ...legacyRow,
      uplinkHz: 145_990_000,
      downlinkHz: 437_800_000,
      uplinkToneHz: 67,
      downlinkToneHz: null,
    };
    await store.seedProject({
      meta,
      // Pre-schema-v26 rows persisted with scalar uplink/downlink/tone fields, no transmitters.
      satellites: [legacyStoredRow as unknown as Satellite],
    });

    const loaded = await store.getSatellite(meta.projectId, satellite.id);
    expect(loaded?.transmitters).toHaveLength(1);
    expect(loaded?.transmitters[0]).toMatchObject({
      label: 'Transmitter',
      source: 'manual',
      uplinkHz: 145_990_000,
      downlinkHz: 437_800_000,
      uplinkToneHz: 67,
      downlinkToneHz: null,
    });
    expect(loaded).not.toHaveProperty('uplinkHz');

    const listed = await store.listSatellites(meta.projectId);
    expect(listed[0]?.transmitters).toHaveLength(1);
  });

  it('leaves already-migrated satellite rows with a transmitters array untouched', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const satellite = newSatellite(meta.projectId, 'ISS', 25544);
    await store.seedProject({ meta, satellites: [satellite] });

    const loaded = await store.getSatellite(meta.projectId, satellite.id);
    expect(loaded?.transmitters).toEqual(satellite.transmitters);
  });

  it('migrates legacy ssb-usb mode profiles on read', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const channel = newChannel(meta.projectId, 'SSB Legacy');
    const legacyChannel: Channel = {
      ...channel,
      modeProfiles: [
        {
          mode: 'ssb-usb',
          squelch: null,
          rxTone: 'none',
          txTone: 'none',
          bandwidthKHz: null,
        } as unknown as Channel['modeProfiles'][number],
      ],
    };
    await store.seedProject({ meta, channels: [legacyChannel] });

    const loaded = await store.getChannel(meta.projectId, channel.id);
    expect(loaded?.modeProfiles).toHaveLength(1);
    const profile = loaded?.modeProfiles[0];
    expect(profile?.mode).toBe('ssb');
    if (profile?.mode === 'ssb') {
      expect(profile.ssbSideband).toBe('usb');
    }
  });

  it('bumps revision on update and rejects stale writes', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const channel = newChannel(meta.projectId, 'Local');
    await store.seedProject({ meta, channels: [channel] });

    const ok = await store.putChannel({ ...channel, name: 'Local 2' }, channel.revision);
    expect(ok).toEqual({ ok: true, revision: 2 });

    const loaded = await store.getChannel(meta.projectId, channel.id);
    expect(loaded?.name).toBe('Local 2');
    expect(loaded?.revision).toBe(2);

    const conflict = await store.putChannel({ ...channel, name: 'Local 3' }, 1);
    expect(conflict).toEqual({ ok: false, reason: 'revision_conflict' });
  });

  it('deletes an entity', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const tg = newTalkGroup(meta.projectId, 'World', 91);
    await store.seedProject({ meta, talkGroups: [tg] });

    await store.deleteEntity(meta.projectId, 'talkGroup', tg.id);
    expect(await store.getTalkGroup(meta.projectId, tg.id)).toBeNull();
    expect(await store.listTalkGroups(meta.projectId)).toHaveLength(0);
  });

  it('isolates rows per project', async () => {
    const store = makeStore();
    const metaA = newProjectMeta('A');
    const metaB = newProjectMeta('B');
    await store.seedProject({ meta: metaA, channels: [newChannel(metaA.projectId, 'A-ch')] });
    await store.seedProject({ meta: metaB, channels: [newChannel(metaB.projectId, 'B-ch')] });

    expect(await store.listChannels(metaA.projectId)).toHaveLength(1);
    expect(await store.listChannels(metaB.projectId)).toHaveLength(1);
  });

  it('notifies local subscribers and broadcasts cross-tab', async () => {
    const dbName = `shared-db-${counter++}`;
    const tabA = new IndexedDbProjectPersistence(dbName);
    const tabB = new IndexedDbProjectPersistence(dbName);
    open.add(tabA);
    open.add(tabB);

    const local: PersistenceChange[] = [];
    const crossTab: PersistenceChange[] = [];
    tabA.subscribe((c) => local.push(c));
    tabB.subscribe((c) => crossTab.push(c));

    const meta = newProjectMeta('Test');
    await tabA.seedProject({ meta });
    const channel = newChannel(meta.projectId, 'Local');
    await tabA.putChannel(channel, null);

    // BroadcastChannel delivers asynchronously; let the microtask/macrotask flush.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(local).toContainEqual({
      projectId: meta.projectId,
      kind: 'channel',
      id: channel.id,
      op: 'put',
    });
    expect(crossTab).toContainEqual({
      projectId: meta.projectId,
      kind: 'channel',
      id: channel.id,
      op: 'put',
    });
  });

  it('persists a single aprs configuration per project', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });

    const zulu = newAprsConfiguration(meta.projectId, 'Zulu');
    const alpha = newAprsConfiguration(meta.projectId, 'Alpha');
    await store.putAprsConfiguration(zulu, null);
    await store.putAprsConfiguration(alpha, null);

    const configs = await store.listAprsConfigurations(meta.projectId);
    expect(configs).toHaveLength(1);
    expect(configs[0]?.name).toBe('Alpha');
    expect(await store.getAprsConfiguration(meta.projectId, zulu.id)).toBeNull();
    expect(await store.getAprsConfiguration(meta.projectId, alpha.id)).toMatchObject({
      name: 'Alpha',
    });
  });

  it('loadProjectSeed returns full aggregate including radioBuilds and egressPaths', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const channel = newChannel(meta.projectId, 'Local');
    const { build, egressPaths } = newRadioBuildWithEgresses(meta.projectId, 'baofeng-dm1701');
    await store.seedProject({
      meta,
      channels: [channel],
      radioBuilds: [build],
      egressPaths,
    });

    const seed = await store.loadProjectSeed(meta.projectId);
    expect(seed?.meta.id).toBe(meta.id);
    expect(seed?.channels).toHaveLength(1);
    expect(seed?.radioBuilds).toHaveLength(1);
    expect(seed?.radioBuilds?.[0]?.id).toBe(build.id);
    expect(seed?.egressPaths).toHaveLength(egressPaths.length);
  });

  it('putRadioBuild and putEgressPath persist and read back rows', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });
    const { build, egressPaths } = newRadioBuildWithEgresses(meta.projectId, 'baofeng-uv5r-mini');

    await store.putRadioBuild(build, null);
    for (const egress of egressPaths) {
      await store.putEgressPath(egress, null);
    }

    expect(await store.getRadioBuild(meta.projectId, build.id)).toMatchObject({ id: build.id });
    expect(await store.listRadioBuilds(meta.projectId)).toHaveLength(1);
    expect(await store.listEgressPaths(meta.projectId)).toHaveLength(egressPaths.length);
  });

  it('listEgressPathsForBuild scopes to one radio build', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });
    const buildA = newRadioBuildWithEgresses(meta.projectId, 'baofeng-uv5r-mini', 'A');
    const buildB = newRadioBuildWithEgresses(meta.projectId, 'baofeng-dm1701', 'B');
    await store.putRadioBuild(buildA.build, null);
    await store.putRadioBuild(buildB.build, null);
    for (const egress of [...buildA.egressPaths, ...buildB.egressPaths]) {
      await store.putEgressPath(egress, null);
    }

    const forA = await store.listEgressPathsForBuild(meta.projectId, buildA.build.id);
    const forB = await store.listEgressPathsForBuild(meta.projectId, buildB.build.id);
    expect(forA).toHaveLength(buildA.egressPaths.length);
    expect(forA.every((row) => row.radioBuildId === buildA.build.id)).toBe(true);
    expect(forB).toHaveLength(buildB.egressPaths.length);
    expect(forB.every((row) => row.radioBuildId === buildB.build.id)).toBe(true);
  });

  it('upgrading a legacy DB drops formatBuilds but keeps the library', async () => {
    const dbName = `legacy-db-${counter++}`;
    const meta = newProjectMeta('Legacy');
    const channel = newChannel(meta.projectId, 'Kept');

    // Simulate a pre-#654 DB: projects/channels + the now-removed formatBuilds store.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        const projects = db.createObjectStore('projects', { keyPath: ['projectId', 'id'] });
        projects.createIndex('byProject', 'projectId', { unique: false });
        const channels = db.createObjectStore('channels', { keyPath: ['projectId', 'id'] });
        channels.createIndex('byProject', 'projectId', { unique: false });
        const legacyBuilds = db.createObjectStore('formatBuilds', { keyPath: ['projectId', 'id'] });
        legacyBuilds.createIndex('byProject', 'projectId', { unique: false });
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['projects', 'channels', 'formatBuilds'], 'readwrite');
        tx.objectStore('projects').put(meta);
        tx.objectStore('channels').put(channel);
        tx.objectStore('formatBuilds').put({
          id: 'legacy-build',
          projectId: meta.projectId,
          revision: 1,
          updatedAt: meta.updatedAt,
          name: 'Legacy build',
          formatId: 'opengd77',
          profileId: 'opengd77-1701',
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    const store = new IndexedDbProjectPersistence(dbName);
    open.add(store);

    expect(await store.loadProjectMeta(meta.projectId)).toMatchObject({ name: 'Legacy' });
    expect(await store.listChannels(meta.projectId)).toHaveLength(1);
    expect(await store.listRadioBuilds(meta.projectId)).toHaveLength(0);

    const rawDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(rawDb.objectStoreNames.contains('formatBuilds')).toBe(false);
    expect(rawDb.objectStoreNames.contains('radioBuilds')).toBe(true);
    expect(rawDb.objectStoreNames.contains('egressPaths')).toBe(true);
    rawDb.close();
  });

  it('upgrading a v29 DB turns channel DMR and NXDN numbers into Digital IDs per project', async () => {
    const dbName = `v29-db-${counter++}`;
    const metaA = newProjectMeta('A');
    const metaB = newProjectMeta('B');
    const stamp = '2026-01-02T03:04:05.000Z';
    const legacy = (projectId: string, id: string, profiles: Record<string, unknown>[]): Channel =>
      ({
        ...newChannel(projectId, id),
        id,
        revision: 7,
        updatedAt: stamp,
        modeProfiles: profiles,
      }) as unknown as Channel;
    const dmr = (dmrId: number | null) => ({ mode: 'dmr', colourCode: 1, dmrId });
    const rows = [
      legacy(metaA.projectId, 'a1', [dmr(2351234)]),
      legacy(metaA.projectId, 'a2', [dmr(2351234), { mode: 'nxdn', rxRan: 1, unitId: 5 }]),
      legacy(metaA.projectId, 'a3', [dmr(null)]),
      legacy(metaA.projectId, 'a4', [{ mode: 'fm', squelch: null }]),
      legacy(metaB.projectId, 'b1', [dmr(2351234)]),
      // A partial row with no profiles at all must not abort the upgrade.
      (() => {
        const partial = legacy(metaA.projectId, 'a5', []) as unknown as Record<string, unknown>;
        delete partial.modeProfiles;
        return partial as unknown as Channel;
      })(),
    ];

    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(dbName, 29);
      req.onupgradeneeded = () => {
        for (const name of ['projects', 'channels']) {
          const os = req.result.createObjectStore(name, { keyPath: ['projectId', 'id'] });
          os.createIndex('byProject', 'projectId', { unique: false });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['projects', 'channels'], 'readwrite');
        tx.objectStore('projects').put(metaA);
        tx.objectStore('projects').put(metaB);
        for (const row of rows) tx.objectStore('channels').put(row);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      req.onerror = () => reject(req.error);
    });

    const store = new IndexedDbProjectPersistence(dbName);
    open.add(store);

    const idsA = await store.listOwnDigitalIds(metaA.projectId);
    const idsB = await store.listOwnDigitalIds(metaB.projectId);
    expect(idsA.map((r) => [r.protocol, r.number, r.name, r.isDefault]).sort()).toEqual([
      ['dmr', 2351234, '', false],
      ['nxdn', 5, '', false],
    ]);
    expect(idsB.map((r) => [r.protocol, r.number, r.isDefault])).toEqual([['dmr', 2351234, false]]);
    // No default is set by the migration.
    expect([...idsA, ...idsB].some((r) => r.isDefault)).toBe(false);

    const channels = await store.listChannels(metaA.projectId);
    const byId = new Map(channels.map((c) => [c.id, c]));
    // The DB opened, the other rows migrated, and the partial row is still there.
    expect(byId.has('a5')).toBe(true);
    const dmrRow = idsA.find((r) => r.protocol === 'dmr')!;
    const nxdnRow = idsA.find((r) => r.protocol === 'nxdn')!;
    const profile = (id: string, index = 0) =>
      byId.get(id)!.modeProfiles[index] as unknown as Record<string, unknown>;
    expect(profile('a1').ownDigitalIdId).toBe(dmrRow.id);
    expect(profile('a2', 0).ownDigitalIdId).toBe(dmrRow.id);
    expect(profile('a2', 1).ownDigitalIdId).toBe(nxdnRow.id);
    expect(profile('a3').ownDigitalIdId).toBeNull();
    for (const key of ['a1', 'a2', 'a3']) {
      for (const p of byId.get(key)!.modeProfiles as unknown as Record<string, unknown>[]) {
        expect(p).not.toHaveProperty('dmrId');
        expect(p).not.toHaveProperty('unitId');
      }
    }
    // A format change, not an edit: revision and timestamp stay.
    for (const c of channels) {
      expect(c.revision).toBe(7);
      expect(c.updatedAt).toBe(stamp);
    }
    // The other project's row is its own.
    const b1 = (await store.listChannels(metaB.projectId))[0]!;
    expect((b1.modeProfiles[0] as unknown as Record<string, unknown>).ownDigitalIdId).toBe(
      idsB[0]!.id,
    );
  });

  it('persists Digital IDs and loads them in the project seed', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });
    const row = {
      id: 'own-1',
      projectId: meta.projectId,
      revision: 1,
      updatedAt: meta.updatedAt,
      name: 'Home',
      protocol: 'dmr' as const,
      number: 2351234,
      isDefault: true,
    };
    expect((await store.putOwnDigitalId(row, null)).ok).toBe(true);
    expect(await store.getOwnDigitalId(meta.projectId, 'own-1')).toMatchObject({
      name: 'Home',
      number: 2351234,
      isDefault: true,
    });
    expect((await store.loadProjectSeed(meta.projectId))?.ownDigitalIds).toHaveLength(1);
    await store.deleteEntity(meta.projectId, 'ownDigitalId', 'own-1');
    expect(await store.listOwnDigitalIds(meta.projectId)).toEqual([]);
  });

  it('replaceProject removes stale rows from a prior seed', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const oldChannel = newChannel(meta.projectId, 'Old');
    const newChannelRow = newChannel(meta.projectId, 'New');
    await store.seedProject({ meta, channels: [oldChannel] });

    await store.replaceProject(meta.projectId, {
      meta,
      channels: [newChannelRow],
    });

    expect(await store.getChannel(meta.projectId, oldChannel.id)).toBeNull();
    expect(await store.getChannel(meta.projectId, newChannelRow.id)).not.toBeNull();
    expect(await store.listChannels(meta.projectId)).toHaveLength(1);
  });

  it('putDigitalContactsBatch persists rows in one transaction', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });

    const batch = await store.putDigitalContactsBatch([
      { row: newDigitalContact(meta.projectId, 'Alpha', 1, 'dmr'), expectedRevision: null },
      { row: newDigitalContact(meta.projectId, 'Bravo', 2, 'dmr'), expectedRevision: null },
    ]);

    expect(batch.results).toEqual([
      { ok: true, revision: 1 },
      { ok: true, revision: 1 },
    ]);
    const contacts = await store.listDigitalContacts(meta.projectId);
    expect(contacts).toHaveLength(2);
  });

  it('deleteDigitalContactsForProject clears the project partition', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const other = newProjectMeta('Other');
    await store.seedProject({ meta });
    await store.seedProject({ meta: other });
    await store.putDigitalContactsBatch([
      { row: newDigitalContact(meta.projectId, 'Alpha', 1, 'dmr'), expectedRevision: null },
      { row: newDigitalContact(meta.projectId, 'Bravo', 2, 'dmr'), expectedRevision: null },
      { row: newDigitalContact(other.projectId, 'Keep', 3, 'dmr'), expectedRevision: null },
    ]);

    const changes: PersistenceChange[] = [];
    const unsubscribe = store.subscribe((c) => changes.push(c));
    const result = await store.deleteDigitalContactsForProject(meta.projectId);
    unsubscribe();

    expect(result.deletedCount).toBe(2);
    expect(await store.listDigitalContacts(meta.projectId)).toHaveLength(0);
    expect(await store.listDigitalContacts(other.projectId)).toHaveLength(1);
    expect(changes).toEqual([
      { projectId: meta.projectId, kind: 'digitalContact', id: meta.projectId, op: 'delete' },
    ]);
  });

  it('delete project cascades all library and build rows', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    const channel = newChannel(meta.projectId, 'Local');
    const tg = newTalkGroup(meta.projectId, 'World', 91);
    const { build, egressPaths } = newRadioBuildWithEgresses(meta.projectId, 'baofeng-dm1701');
    await store.seedProject({
      meta,
      channels: [channel],
      talkGroups: [tg],
      radioBuilds: [build],
      egressPaths,
    });

    await store.deleteEntity(meta.projectId, 'project', meta.id);

    expect(await store.loadProjectMeta(meta.projectId)).toBeNull();
    expect(await store.listChannels(meta.projectId)).toHaveLength(0);
    expect(await store.listTalkGroups(meta.projectId)).toHaveLength(0);
    expect(await store.listRadioBuilds(meta.projectId)).toHaveLength(0);
    expect(await store.listEgressPaths(meta.projectId)).toHaveLength(0);
  });

  it('persists satellites and lists them sorted by name', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });

    await store.putSatellite(newSatellite(meta.projectId, 'AO-91', 43017), null);
    await store.putSatellite(newSatellite(meta.projectId, 'ISS (ZARYA)', 25544), null);

    const sats = await store.listSatellites(meta.projectId);
    expect(sats.map((s) => s.name)).toEqual(['AO-91', 'ISS (ZARYA)']);
  });

  it('putSatellitesBatch writes a refresh in one transaction, preserving enable state', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });

    const iss = newSatellite(meta.projectId, 'ISS (ZARYA)', 25544, { enabled: false });
    await store.putSatellite(iss, null);
    const stored = (await store.listSatellites(meta.projectId))[0]!;

    const batch = await store.putSatellitesBatch([
      { row: { ...stored, name: 'ISS (ZARYA) refreshed' }, expectedRevision: stored.revision },
      { row: newSatellite(meta.projectId, 'AO-91', 43017), expectedRevision: null },
    ]);

    expect(batch.results).toEqual([
      { ok: true, revision: 2 },
      { ok: true, revision: 1 },
    ]);
    const sats = await store.listSatellites(meta.projectId);
    expect(sats).toHaveLength(2);
    expect(sats.find((s) => s.noradId === 25544)).toMatchObject({
      name: 'ISS (ZARYA) refreshed',
      enabled: false,
    });
  });

  it('putTrackingSettings replaces the singleton row for the project', async () => {
    const store = makeStore();
    const meta = newProjectMeta('Test');
    await store.seedProject({ meta });

    const first = newTrackingSettings(meta.projectId, { maidenheadLocator: 'IO85' });
    const second = newTrackingSettings(meta.projectId, { maidenheadLocator: 'IO86' });
    await store.putTrackingSettings(first, null);
    await store.putTrackingSettings(second, null);

    const rows = await store.listTrackingSettings(meta.projectId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.maidenheadLocator).toBe('IO86');
    expect(await store.getTrackingSettings(meta.projectId, first.id)).toBeNull();
  });
});
