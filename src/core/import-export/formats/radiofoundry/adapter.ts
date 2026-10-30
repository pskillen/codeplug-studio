import type { BinaryCpsExportAdapter } from '../../exportAdapter.ts';
import { RADIOFOUNDRY_CODEPLUG_FILE_NAME } from './layout.ts';
import { serialiseRadioFoundryCodeplug } from './serialise.ts';

export const radiofoundryExportAdapter = {
  id: 'radiofoundry',
  label: 'RadioFoundry codeplug',
  status: 'shipped',
  delivery: 'binary-cps',
  defaultFileName: RADIOFOUNDRY_CODEPLUG_FILE_NAME,
  defaultExportSettings: {
    defaultScanInclusion: 'scan',
    expandModes: false,
    expandRxGroupLists: false,
    exportScratchChannels: false,
    exportZoneDerivedScanLists: false,
  },
  serialise(assembled) {
    return serialiseRadioFoundryCodeplug(assembled);
  },
} satisfies BinaryCpsExportAdapter;
