import { describe, expect, it } from 'vitest';
import {
  newAnalogContact,
  newAprsConfiguration,
  newChannel,
  newDigitalContact,
  newOwnDigitalId,
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
    ownDigitalIdId: null,
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

  describe('Digital IDs', () => {
    it('the first ID of a protocol becomes its default, later ones do not', async () => {
      const { persistence, service, projectId } = await setup();
      await service.saveOwnDigitalId(newOwnDigitalId(projectId, 'dmr', 'Home', 2351234), null);
      await service.saveOwnDigitalId(newOwnDigitalId(projectId, 'dmr', 'Club', 2351235), null);
      await service.saveOwnDigitalId(newOwnDigitalId(projectId, 'nxdn', 'Home NXDN', 1234), null);
      const rows = await persistence.listOwnDigitalIds(projectId);
      const byName = new Map(rows.map((r) => [r.name, r.isDefault]));
      expect(byName.get('Home')).toBe(true);
      expect(byName.get('Club')).toBe(false);
      expect(byName.get('Home NXDN')).toBe(true);
    });

    it('editing keeps the default flag', async () => {
      const { persistence, service, projectId } = await setup();
      await service.saveOwnDigitalId(newOwnDigitalId(projectId, 'dmr', 'Home', 2351234), null);
      const [home] = await persistence.listOwnDigitalIds(projectId);
      await service.saveOwnDigitalId(
        { ...home!, name: 'Renamed', isDefault: false },
        home!.revision,
      );
      const [after] = await persistence.listOwnDigitalIds(projectId);
      expect(after).toMatchObject({ name: 'Renamed', isDefault: true });
    });

    it('Set as default moves the default within its protocol only', async () => {
      const { persistence, service, projectId } = await setup();
      await service.saveOwnDigitalId(newOwnDigitalId(projectId, 'dmr', 'Home', 2351234), null);
      await service.saveOwnDigitalId(newOwnDigitalId(projectId, 'dmr', 'Club', 2351235), null);
      await service.saveOwnDigitalId(newOwnDigitalId(projectId, 'nxdn', 'NX', 1234), null);
      const club = (await persistence.listOwnDigitalIds(projectId)).find((r) => r.name === 'Club')!;
      await service.setDefaultOwnDigitalId(projectId, club.id);
      const defaults = (await persistence.listOwnDigitalIds(projectId))
        .filter((r) => r.isDefault)
        .map((r) => r.name)
        .sort();
      expect(defaults).toEqual(['Club', 'NX']);
    });

    it('deleting the default leaves none and promotes nothing', async () => {
      const { persistence, service, projectId } = await setup();
      await service.saveOwnDigitalId(newOwnDigitalId(projectId, 'dmr', 'Home', 2351234), null);
      await service.saveOwnDigitalId(newOwnDigitalId(projectId, 'dmr', 'Club', 2351235), null);
      const home = (await persistence.listOwnDigitalIds(projectId)).find((r) => r.name === 'Home')!;
      expect(await service.deleteWithIntegrity(projectId, 'ownDigitalId', home.id)).toEqual({
        ok: true,
      });
      const rows = await persistence.listOwnDigitalIds(projectId);
      expect(rows.map((r) => [r.name, r.isDefault])).toEqual([['Club', false]]);
    });

    it('an ID a channel chooses cannot be deleted, the default alone can', async () => {
      const { persistence, service, projectId } = await setup();
      await service.saveOwnDigitalId(newOwnDigitalId(projectId, 'dmr', 'Home', 2351234), null);
      const [home] = await persistence.listOwnDigitalIds(projectId);
      const channel = {
        ...newChannel(projectId, 'Chan'),
        modeProfiles: [
          {
            mode: 'dmr' as const,
            colourCode: 1,
            timeslot: 1 as const,
            ownDigitalIdId: home!.id,
            contactRef: null,
            rxGroupListId: null,
          },
        ],
      };
      await persistence.putChannel(channel, null);
      const outcome = await service.deleteWithIntegrity(projectId, 'ownDigitalId', home!.id);
      expect(outcome.ok).toBe(false);
    });
  });
});
