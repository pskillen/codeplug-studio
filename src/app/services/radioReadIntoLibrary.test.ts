import { describe, expect, it, vi } from 'vitest';
import {
  newChannel,
  newProjectMeta,
  newRadioBuildWithEgresses,
  newZone,
} from '@core/domain/factories.ts';
import { librarySliceFrom } from '@core/services/assemble.ts';
import { readChannelNameCandidates } from '@core/services/radioRead/readNameCandidates.ts';
import { readZoneNameCandidates } from '@core/services/radioRead/readZoneNameCandidates.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/index.ts';
import type { RadioLibraryRead } from '@integrations/radio-io/readIntoLibrary.ts';
import { LibraryService } from '@app/state/libraryService.ts';
import { BuildService } from '@app/state/buildService.ts';
import {
  applyRadioReadToLibrary,
  descriptorSupportsReadIntoLibrary,
} from './radioReadIntoLibrary.ts';

const profileId = 'radio-io-uv5r-mini';
const modProfile = 'radio-io-uv5r-mini-mm9pdy';
function read(profile = profileId): RadioLibraryRead {
  return {
    modelLabel: 'Mini',
    firmwareLabel: 'Stock',
    profileId: profile,
    channels: [
      {
        slotIndex: 1,
        empty: false,
        wireName: 'Local',
        rxHz: 145500000,
        txHz: 145500000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 20,
        bandwidth: 'NFM',
        scanAdd: true,
      },
    ],
    zones: [],
    droppedFields: [],
    notes: [],
  };
}
async function setup() {
  const persistence = new InMemoryProjectPersistence();
  const meta = newProjectMeta('Test');
  await persistence.seedProject({ meta });
  return { persistence, projectId: meta.projectId };
}

describe('applyRadioReadToLibrary', () => {
  it('creates and reuses a build and library rows', async () => {
    const args = { ...(await setup()), read: read(modProfile) };
    args.read.zones = [{ wireName: 'Local', channelNumbers: [1], scanChannelNumbers: [1] }];
    expect(await applyRadioReadToLibrary(args)).toMatchObject({
      ok: true,
      summary: {
        channels: { created: 1 },
        zones: { created: 1 },
        build: { action: 'created', channelsLeftOut: 0, zonesLeftOut: 0 },
      },
    });
    const revision = (await new BuildService(args.persistence).listBuilds(args.projectId))[0]!
      .revision;
    expect(await applyRadioReadToLibrary(args)).toMatchObject({
      ok: true,
      summary: {
        channels: { unchanged: 1 },
        zones: { unchanged: 1 },
        build: { action: 'updated', channelsLeftOut: 0, zonesLeftOut: 0 },
      },
    });
    expect(await new BuildService(args.persistence).listBuilds(args.projectId)).toHaveLength(1);
    expect((await new BuildService(args.persistence).listBuilds(args.projectId))[0]!.revision).toBe(
      revision,
    );
    expect(
      (await new LibraryService(args.persistence).loadLibrary(args.projectId)).channels,
    ).toHaveLength(1);
  });
  it('matches shortened zone names and excludes unread rows without deleting them', async () => {
    const args = { ...(await setup()), read: read(modProfile) };
    const extra = newChannel(args.projectId, 'Extra');
    const zone = newZone(args.projectId, 'Regional Repeaters North');
    const extraZone = newZone(args.projectId, 'Other');
    await args.persistence.putChannel(extra, null);
    await args.persistence.putZone(zone, null);
    await args.persistence.putZone(extraZone, null);
    const build = newRadioBuildWithEgresses(args.projectId, 'baofeng-uv5r-mini-mm9pdy').build;
    const library = await new LibraryService(args.persistence).loadLibrary(args.projectId);
    const name = readZoneNameCandidates(
      librarySliceFrom(library),
      build,
      'radio-io',
      modProfile,
    ).get(zone.id)![0]!;
    args.read.zones = [{ wireName: name, channelNumbers: [1] }];
    expect(await applyRadioReadToLibrary(args)).toMatchObject({
      ok: true,
      summary: { zones: { updated: 1 }, build: { channelsLeftOut: 1, zonesLeftOut: 1 } },
    });
    expect(await applyRadioReadToLibrary(args)).toMatchObject({
      ok: true,
      summary: { zones: { unchanged: 1 }, build: { channelsLeftOut: 0, zonesLeftOut: 0 } },
    });
    const after = await new LibraryService(args.persistence).loadLibrary(args.projectId);
    expect(after.zones).toHaveLength(2);
    expect(after.channels).toHaveLength(2);
  });
  it('matches a shortened channel name, preserves power and adds AM alongside FM', async () => {
    const args = { ...(await setup()), read: read() };
    const channel = {
      ...newChannel(args.projectId, 'A Very Long Repeater Name'),
      callsign: 'GB3ABC',
      rxFrequency: 145500000,
      txFrequency: 145500000,
      power: 75,
      primaryMode: 'fm' as const,
      modeProfiles: [
        {
          mode: 'fm' as const,
          squelch: null,
          rxTone: 'none' as const,
          txTone: 'none' as const,
          bandwidthKHz: 12.5 as const,
        },
      ],
    };
    await args.persistence.putChannel(channel, null);
    const library = await new LibraryService(args.persistence).loadLibrary(args.projectId);
    const build = newRadioBuildWithEgresses(args.projectId, 'baofeng-uv5r-mini').build;
    const candidates = readChannelNameCandidates(
      librarySliceFrom(library),
      build,
      'radio-io',
      profileId,
    ).get(channel.id)!;
    expect(candidates.length).toBeGreaterThan(0);
    args.read.channels[0] = {
      ...args.read.channels[0]!,
      wireName: candidates[0]!,
      analogMode: 'am',
      rxTone: { kind: 'ctcss', hz: 88.5 },
    };
    expect(await applyRadioReadToLibrary(args)).toMatchObject({
      ok: true,
      summary: { channels: { updated: 1, created: 0 } },
    });
    const updated = (await new LibraryService(args.persistence).loadLibrary(args.projectId))
      .channels[0]!;
    expect(updated.power).toBe(75);
    expect(updated.modeProfiles.map((p) => p.mode)).toEqual(['fm', 'am']);
    expect(updated.modeProfiles[1]).toMatchObject({ mode: 'am', rxTone: '88.5' });
  });
  it('rejects unknown profiles and reports partial saves on build conflict', async () => {
    const args = { ...(await setup()), read: read('unknown') };
    expect(await applyRadioReadToLibrary(args)).toMatchObject({
      ok: false,
      message: expect.stringContaining('Nothing was saved'),
    });
    args.read = read();
    vi.spyOn(args.persistence, 'putRadioBuild').mockResolvedValue({
      ok: false,
      reason: 'revision_conflict',
    });
    expect(await applyRadioReadToLibrary(args)).toMatchObject({
      ok: false,
      message: expect.stringContaining('1 channels and 0 zones saved'),
    });
  });
  it('detects a descriptor hook', () => {
    expect(descriptorSupportsReadIntoLibrary({ readIntoLibrary: {} })).toBe(true);
    expect(descriptorSupportsReadIntoLibrary({})).toBe(false);
  });
});

it('repairs egresses after a partial build save on retry', async () => {
  const args = { ...(await setup()), read: read() };
  const put = vi
    .spyOn(args.persistence, 'putEgressPath')
    .mockResolvedValueOnce({ ok: false, reason: 'revision_conflict' });
  expect(await applyRadioReadToLibrary(args)).toMatchObject({
    ok: false,
    message: expect.stringContaining('partially saved'),
  });
  const build = (await new BuildService(args.persistence).listBuilds(args.projectId))[0]!;
  expect(await applyRadioReadToLibrary(args)).toMatchObject({
    ok: true,
    summary: { channels: { unchanged: 1 }, build: { id: build.id, action: 'updated' } },
  });
  const paths = await args.persistence.listEgressPathsForBuild(args.projectId, build.id);
  expect(paths.find((path) => path.id === build.defaultEgressPathId)).toBeDefined();
  expect(paths.length).toBeGreaterThan(0);
  put.mockRestore();
});

it('selects the started matching build, otherwise the first matching build', async () => {
  const args = { ...(await setup()), read: read() };
  const first = newRadioBuildWithEgresses(args.projectId, 'baofeng-uv5r-mini');
  const second = newRadioBuildWithEgresses(args.projectId, 'baofeng-uv5r-mini');
  const other = newRadioBuildWithEgresses(args.projectId, 'baofeng-uv5r-mini-mm9pdy');
  for (const item of [first, second, other]) {
    await args.persistence.putRadioBuild(item.build, null);
    for (const path of item.egressPaths) await args.persistence.putEgressPath(path, null);
  }
  expect(
    await applyRadioReadToLibrary({ ...args, startedFromBuildId: second.build.id }),
  ).toMatchObject({ ok: true, summary: { build: { id: second.build.id } } });
  expect(
    await applyRadioReadToLibrary({ ...args, startedFromBuildId: other.build.id }),
  ).toMatchObject({
    ok: true,
    summary: { build: { id: first.build.id }, buildNote: expect.any(String) },
  });
  expect(await applyRadioReadToLibrary(args)).toMatchObject({
    ok: true,
    summary: { build: { id: first.build.id } },
  });
});

it('keeps existing zones when the radio returns no zone table', async () => {
  const args = { ...(await setup()), read: read(modProfile) };
  args.read.zones = [{ wireName: 'Local', channelNumbers: [1], scanChannelNumbers: [1] }];
  expect((await applyRadioReadToLibrary(args)).ok).toBe(true);
  const before = (await new BuildService(args.persistence).listBuilds(args.projectId))[0]!;
  args.read.zones = [];
  expect(await applyRadioReadToLibrary(args)).toMatchObject({
    ok: true,
    summary: { zones: { created: 0, updated: 0 }, build: { zonesLeftOut: 0 } },
  });
  const after = (await new BuildService(args.persistence).listBuilds(args.projectId))[0]!;
  expect(after.zoneOverrides).toEqual(before.zoneOverrides);
  expect(after.layout).toEqual(before.layout);
});

it('sets power and AM on creation and preserves FM on an update', async () => {
  const args = { ...(await setup()), read: read() };
  args.read.channels[0]!.analogMode = 'am';
  expect((await applyRadioReadToLibrary(args)).ok).toBe(true);
  let channel = (await new LibraryService(args.persistence).loadLibrary(args.projectId))
    .channels[0]!;
  expect(channel.power).toBe(20);
  expect(channel.modeProfiles.map((profile) => profile.mode)).toContain('am');
  args.read.channels[0]!.analogMode = 'fm';
  args.read.channels[0]!.powerPercent = 100;
  expect((await applyRadioReadToLibrary(args)).ok).toBe(true);
  channel = (await new LibraryService(args.persistence).loadLibrary(args.projectId)).channels[0]!;
  expect(channel.power).toBe(20);
  expect(channel.modeProfiles.map((profile) => profile.mode)).toEqual(
    expect.arrayContaining(['am', 'fm']),
  );
});

it('creates a detected-target build when started from a different target', async () => {
  const args = { ...(await setup()), read: read() };
  const other = newRadioBuildWithEgresses(args.projectId, 'baofeng-uv5r-mini-mm9pdy');
  await args.persistence.putRadioBuild(other.build, null);
  const result = await applyRadioReadToLibrary({ ...args, startedFromBuildId: other.build.id });
  expect(result).toMatchObject({
    ok: true,
    summary: { build: { action: 'created' }, buildNote: expect.any(String) },
  });
  const builds = await new BuildService(args.persistence).listBuilds(args.projectId);
  expect(builds).toHaveLength(2);
  const created = builds.find((build) => build.radioTargetId === 'baofeng-uv5r-mini')!;
  expect(
    (await args.persistence.listEgressPathsForBuild(args.projectId, created.id)).length,
  ).toBeGreaterThan(0);
});

it('adds FM to a matching DMR channel without replacing DMR or its power', async () => {
  const args = { ...(await setup()), read: read() };
  const channel = {
    ...newChannel(args.projectId, 'Local'),
    rxFrequency: 145500000,
    txFrequency: 145500000,
    power: 75,
    primaryMode: 'dmr' as const,
    modeProfiles: [
      {
        mode: 'dmr' as const,
        colourCode: 1,
        timeslot: 1 as const,
        ownDigitalIdId: null,
        contactRef: null,
        rxGroupListId: null,
      },
    ],
  };
  await args.persistence.putChannel(channel, null);
  expect(await applyRadioReadToLibrary(args)).toMatchObject({
    ok: true,
    summary: { channels: { updated: 1, created: 0 } },
  });
  const updated = (await new LibraryService(args.persistence).loadLibrary(args.projectId))
    .channels[0]!;
  expect(updated.power).toBe(75);
  expect(updated.modeProfiles.map((profile) => profile.mode)).toEqual(['dmr', 'fm']);
  expect(await applyRadioReadToLibrary(args)).toMatchObject({
    ok: true,
    summary: { channels: { unchanged: 1 } },
  });
});

it('creates a zone whose radio name is unrelated to existing zones', async () => {
  const args = { ...(await setup()), read: read(modProfile) };
  await args.persistence.putZone(newZone(args.projectId, 'Regional Repeaters North'), null);
  args.read.zones = [{ wireName: 'Other', channelNumbers: [1] }];
  expect(await applyRadioReadToLibrary(args)).toMatchObject({
    ok: true,
    summary: { zones: { created: 1, updated: 0 } },
  });
  expect(
    (await new LibraryService(args.persistence).loadLibrary(args.projectId)).zones,
  ).toHaveLength(2);
});
