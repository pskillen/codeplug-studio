import { describe, expect, it } from 'vitest';
import {
  newAnalogContact,
  newAprsConfiguration,
  newChannel,
  newDigitalContact,
  newProjectMeta,
  newRadioBuild,
  newRxGroupList,
  newTalkGroup,
  newZone,
} from '@core/domain/factories.ts';
import type { ChannelModeProfileDMR } from '@core/models/library.ts';
import { InMemoryProjectPersistence } from '@integrations/persistence/index.ts';
import { LibraryService } from './libraryService.ts';

async function setup() {
  const persistence = new InMemoryProjectPersistence();
  const meta = newProjectMeta('Test');
  await persistence.seedProject({ meta });
  return { persistence, service: new LibraryService(persistence), projectId: meta.projectId };
}

function dmrProfile(contactId: string): ChannelModeProfileDMR {
  return {
    mode: 'dmr',
    colourCode: 1,
    timeslot: 1,
    dmrId: null,
    contactRef: { kind: 'digitalContact', id: contactId },
    rxGroupListId: null,
  };
}

describe('LibraryService', () => {
  it('aggregates entity rows into a Library', async () => {
    const { persistence, service, projectId } = await setup();
    await persistence.putChannel(newChannel(projectId, 'Local'), null);
    await persistence.putTalkGroup(newTalkGroup(projectId, 'World', 91), null);

    const library = await service.loadLibrary(projectId);
    expect(library.channels).toHaveLength(1);
    expect(library.talkGroups).toHaveLength(1);
    expect(library.zones).toHaveLength(0);
  });

  it('blocks deleting an entity that is still referenced', async () => {
    const { persistence, service, projectId } = await setup();
    const channel = newChannel(projectId, 'Local');
    const zone = {
      ...newZone(projectId, 'Home'),
      members: [{ kind: 'channel' as const, channelId: channel.id }],
    };
    await persistence.putChannel(channel, null);
    await persistence.putZone(zone, null);

    const outcome = await service.deleteWithIntegrity(projectId, 'channel', channel.id);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.references[0]?.fromName).toBe('Home');
    }
    // Channel still present because the delete was blocked.
    expect(await persistence.getChannel(projectId, channel.id)).not.toBeNull();
  });

  it('deletes when no references remain', async () => {
    const { persistence, service, projectId } = await setup();
    const tg = newTalkGroup(projectId, 'Orphan', 1);
    await persistence.putTalkGroup(tg, null);

    const outcome = await service.deleteWithIntegrity(projectId, 'talkGroup', tg.id);
    expect(outcome.ok).toBe(true);
    expect(await persistence.getTalkGroup(projectId, tg.id)).toBeNull();
  });

  it('blocks deleting a zone referenced as a nested member', async () => {
    const { persistence, service, projectId } = await setup();
    const inner = newZone(projectId, 'Inner');
    const outer = {
      ...newZone(projectId, 'Outer'),
      members: [{ kind: 'zone' as const, zoneId: inner.id }],
    };
    await persistence.putZone(inner, null);
    await persistence.putZone(outer, null);

    const outcome = await service.deleteWithIntegrity(projectId, 'zone', inner.id);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.references[0]?.fromName).toBe('Outer');
      expect(outcome.references[0]?.relationship).toBe('nested zone member');
    }
    expect(await persistence.getZone(projectId, inner.id)).not.toBeNull();
  });

  it('enforces a single APRS configuration per project on put', async () => {
    const { persistence, projectId } = await setup();
    const first = newAprsConfiguration(projectId, 'First');
    const second = newAprsConfiguration(projectId, 'Second');
    await persistence.putAprsConfiguration(first, null);
    await persistence.putAprsConfiguration(second, null);

    const configs = await persistence.listAprsConfigurations(projectId);
    expect(configs).toHaveLength(1);
    expect(configs[0]?.name).toBe('Second');
    expect(await persistence.getAprsConfiguration(projectId, first.id)).toBeNull();
  });

  it('deleteAllDigitalContacts clears contacts and cascade-nullifies refs', async () => {
    const { persistence, service, projectId } = await setup();
    const contact = newDigitalContact(projectId, 'Alpha', 123, 'dmr');
    const analog = newAnalogContact(projectId, 'DTMF', '1234');
    const talkGroup = newTalkGroup(projectId, 'World', 91);
    const channel = {
      ...newChannel(projectId, 'Local'),
      modeProfiles: [dmrProfile(contact.id)],
    };
    const rxList = {
      ...newRxGroupList(projectId, 'Group'),
      members: [
        { ref: { kind: 'digitalContact' as const, id: contact.id } },
        { ref: { kind: 'talkGroup' as const, id: talkGroup.id } },
      ],
    };
    const build = {
      ...newRadioBuild(projectId, 'baofeng-dm1701'),
      contactOverrides: [
        { libraryEntityId: contact.id, wireName: 'WireA' },
        { libraryEntityId: analog.id, wireName: 'WireAnalog' },
      ],
    };
    await persistence.putDigitalContact(contact, null);
    await persistence.putAnalogContact(analog, null);
    await persistence.putTalkGroup(talkGroup, null);
    await persistence.putChannel(channel, null);
    await persistence.putRxGroupList(rxList, null);
    await persistence.putRadioBuild(build, null);

    const outcome = await service.deleteAllDigitalContacts(projectId);

    expect(outcome).toEqual({
      deletedCount: 1,
      clearedChannelRefs: 1,
      clearedRxMembers: 1,
      prunedBuildOverrides: 1,
    });
    expect(await persistence.listDigitalContacts(projectId)).toHaveLength(0);
    expect(await persistence.listAnalogContacts(projectId)).toHaveLength(1);

    const updatedChannel = await persistence.getChannel(projectId, channel.id);
    const dmr = updatedChannel?.modeProfiles.find((p) => p.mode === 'dmr');
    expect(dmr && dmr.mode === 'dmr' ? dmr.contactRef : 'missing').toBeNull();

    const updatedRx = await persistence.getRxGroupList(projectId, rxList.id);
    expect(updatedRx?.members).toEqual([{ ref: { kind: 'talkGroup', id: talkGroup.id } }]);

    const updatedBuild = await persistence.getRadioBuild(projectId, build.id);
    expect(updatedBuild?.contactOverrides).toEqual([
      { libraryEntityId: analog.id, wireName: 'WireAnalog' },
    ]);
  });

  it('deleteAllDigitalContacts is a no-op when the directory is empty', async () => {
    const { service, projectId } = await setup();
    expect(await service.deleteAllDigitalContacts(projectId)).toEqual({
      deletedCount: 0,
      clearedChannelRefs: 0,
      clearedRxMembers: 0,
      prunedBuildOverrides: 0,
    });
  });
});
