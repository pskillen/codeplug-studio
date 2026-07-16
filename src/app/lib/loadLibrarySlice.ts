import { normalizeChannelBehaviourDefaults } from '@core/domain/normalizeChannelBehaviourDefaults.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';

/** Load the library entities needed for build wire preview and export projection. */
export async function loadLibrarySlice(
  persistence: ProjectPersistence,
  projectId: string,
): Promise<LibrarySlice> {
  const [
    meta,
    channels,
    zones,
    talkGroups,
    digitalContacts,
    analogContacts,
    rxGroupLists,
    scanLists,
    aprsConfigurations,
  ] = await Promise.all([
    persistence.loadProjectMeta(projectId),
    persistence.listChannels(projectId),
    persistence.listZones(projectId),
    persistence.listTalkGroups(projectId),
    persistence.listDigitalContacts(projectId),
    persistence.listAnalogContacts(projectId),
    persistence.listRxGroupLists(projectId),
    persistence.listScanLists(projectId),
    persistence.listAprsConfigurations(projectId),
  ]);
  return {
    channels,
    zones,
    talkGroups,
    digitalContacts,
    analogContacts,
    rxGroupLists,
    scanLists,
    aprsConfiguration: aprsConfigurations[0] ?? null,
    channelDefaults: normalizeChannelBehaviourDefaults(meta?.channelDefaults),
  };
}
