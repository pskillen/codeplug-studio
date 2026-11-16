import {
  RT95_CALIBRATION_LENGTH,
  RT95_CALIBRATION_START,
} from '@core/radios/retevis/rt95/calibration.ts';
import {
  regionSections,
  type DebugCompareAdapter,
  type DebugCompareArchive,
  type RegionIdentity,
} from '../../debugCompare/index.ts';
import { RT95_MODEL_ID } from './constants.ts';
import {
  RT95_CALIBRATION_REGION_ID,
  RT95_CALIBRATION_REGION_PATH,
  RT95_MMD1_REGION_ID,
  RT95_MMD1_REGION_PATH,
} from './debugCapture.ts';
import { MMD1_BASE, MMD1_END } from './modData/layout.ts';

const EEPROM_VIA_HEAD: RegionIdentity = {
  space: 'RT95 main-body EEPROM via head',
  representation: 'EEPROM bytes',
};

/** Only the RT95 programming image and the two registered EEPROM windows have a defined map. */
export function rt95DebugRegionIdentity(
  archive: DebugCompareArchive,
  id: string,
): RegionIdentity | undefined {
  if (archive.manifest.radioModelId !== RT95_MODEL_ID) return undefined;
  if (id === 'programming-image')
    return { space: 'RT95 programming image', representation: 'programming image bytes' };
  const region = archive.manifest.regions.find((r) => r.id === id);
  if (
    id === RT95_MMD1_REGION_ID &&
    region?.address === MMD1_BASE &&
    region.byteLength <= MMD1_END - MMD1_BASE &&
    region.restoreRole === 'inspect-only' &&
    region.path === RT95_MMD1_REGION_PATH &&
    archive.regions[id]?.length === region.byteLength
  )
    return EEPROM_VIA_HEAD;
  if (
    id === RT95_CALIBRATION_REGION_ID &&
    region?.address === RT95_CALIBRATION_START &&
    region.byteLength <= RT95_CALIBRATION_LENGTH &&
    region.restoreRole === 'inspect-only' &&
    region.path === RT95_CALIBRATION_REGION_PATH &&
    archive.regions[id]?.length === region.byteLength
  )
    return EEPROM_VIA_HEAD;
  return undefined;
}

export const rt95CompareAdapter: DebugCompareAdapter = {
  sections: (a, b) => {
    const result = regionSections(a, b, rt95DebugRegionIdentity);
    // Provenance is stated once per section, never per byte or value.
    return {
      ...result,
      sections: result.sections.map((s) => ({
        ...s,
        note:
          s.id === RT95_CALIBRATION_REGION_ID || s.id === RT95_MMD1_REGION_ID ? 'body' : 'unknown',
      })),
    };
  },
  regionIdentity: rt95DebugRegionIdentity,
};
