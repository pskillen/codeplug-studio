import type { BinaryCpsExportAdapter } from '../../exportAdapter.ts';
import type { BinaryCpsImportAdapter } from '../../importAdapter.ts';
import { RADIOFOUNDRY_CODEPLUG_FILE_NAME } from './layout.ts';
import { parseRadioFoundryCodeplug } from './parse.ts';
import { materialiseRadioFoundryFileExport, serialiseRadioFoundryCodeplug } from './serialise.ts';

export const radiofoundryImportAdapter = {
  id: 'radiofoundry',
  label: 'RadioFoundry codeplug',
  status: 'shipped',
  capabilities: {
    delivery: 'binary-cps',
    entityKinds: ['channels', 'talkGroups', 'contacts', 'rxGroupLists', 'zones', 'radioIds'],
  },
  parse(bytes, projectId, ctx) {
    return parseRadioFoundryCodeplug(bytes, projectId, ctx?.profileId);
  },
} satisfies BinaryCpsImportAdapter;

export const radiofoundryExportAdapter = {
  id: 'radiofoundry',
  label: 'RadioFoundry codeplug',
  status: 'shipped',
  delivery: 'binary-cps',
  defaultFileName: RADIOFOUNDRY_CODEPLUG_FILE_NAME,
  defaultExportSettings: {
    defaultScanInclusion: 'scan',
    expandModes: true,
    expandRxGroupLists: false,
    exportScratchChannels: false,
    exportZoneDerivedScanLists: false,
  },
  serialise(assembled, options) {
    return materialiseRadioFoundryFileExport(serialiseRadioFoundryCodeplug(assembled, options));
  },
} satisfies BinaryCpsExportAdapter;
