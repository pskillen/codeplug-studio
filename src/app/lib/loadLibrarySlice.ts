import type { LibrarySlice } from '@core/services/assemble.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';

/** Load the library entities needed for build wire preview and export projection. */
export async function loadLibrarySlice(
  persistence: ProjectPersistence,
  projectId: string,
): Promise<LibrarySlice> {
  const [channels, zones, talkGroups, digitalContacts, analogContacts, rxGroupLists, scanLists] =
    await Promise.all([
      persistence.listChannels(projectId),
      persistence.listZones(projectId),
      persistence.listTalkGroups(projectId),
      persistence.listDigitalContacts(projectId),
      persistence.listAnalogContacts(projectId),
      persistence.listRxGroupLists(projectId),
      persistence.listScanLists(projectId),
    ]);
  return {
    channels,
    zones,
    talkGroups,
    digitalContacts,
    analogContacts,
    rxGroupLists,
    scanLists,
  };
}
