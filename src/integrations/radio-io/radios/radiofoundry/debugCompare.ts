import type { RadioBackupManifestV1 } from '../../backup/types.ts';
import {
  diffBytes,
  regionSections,
  type ByteComparison,
  type CompareSection,
  type DebugCompareAdapter,
  type DebugCompareArchive,
  type RegionIdentity,
} from '../../debugCompare/index.ts';
import {
  RADIOFOUNDRY_DEBUG_IDDB_SIDECAR,
  RADIOFOUNDRY_DEBUG_INFO_SIDECAR,
  RADIOFOUNDRY_DEBUG_VERSION_SIDECAR,
  RADIOFOUNDRY_REGION,
} from './debugCapture.ts';
import { radioFoundryCableBoardForModelId } from './board.ts';

const IMAGE_IDENTITY: RegionIdentity = {
  space: 'RadioFoundry image offsets',
  representation: 'bytes as read over the codeplug protocol',
};

export function radioFoundryRegionIdentity(
  archive: { manifest: RadioBackupManifestV1; regions: Record<string, Uint8Array> },
  regionId: string,
): RegionIdentity | undefined {
  if (!radioFoundryCableBoardForModelId(archive.manifest.radioModelId)) return undefined;
  if (
    regionId === RADIOFOUNDRY_REGION.eeprom ||
    regionId === RADIOFOUNDRY_REGION.flash ||
    regionId === RADIOFOUNDRY_REGION.area2
  ) {
    return IMAGE_IDENTITY;
  }
  return undefined;
}

const AREA2_NOTE =
  'Area 2 is read only when ticked and trimmed after its last non-blank block, so its length can differ';

function toReported(section: CompareSection): CompareSection {
  return {
    ...section,
    kind: 'reported',
    note: AREA2_NOTE,
  };
}

function sidecarSection(
  id: string,
  label: string,
  a: DebugCompareArchive,
  b: DebugCompareArchive,
  path: string,
): CompareSection {
  const bytesA = a.sidecars[path];
  const bytesB = b.sidecars[path];
  if (!bytesA && !bytesB) {
    return {
      id,
      label,
      kind: 'skipped',
      base: 0,
      changed: 0,
      missing: 0,
      runs: [],
      runsTruncated: 0,
    };
  }
  const diff = diffBytes(bytesA ?? new Uint8Array(0), bytesB ?? new Uint8Array(0), 0);
  return {
    ...diff,
    id,
    label,
    kind: 'reported',
    base: 0,
    a: bytesA,
    b: bytesB,
    missing: (bytesA ? 0 : bytesB?.length ?? 0) + (bytesB ? 0 : bytesA?.length ?? 0),
  };
}

function radioFoundrySections(a: DebugCompareArchive, b: DebugCompareArchive): ByteComparison {
  if (
    !radioFoundryCableBoardForModelId(a.manifest.radioModelId) ||
    !radioFoundryCableBoardForModelId(b.manifest.radioModelId)
  ) {
    return { error: 'Radio models differ; captures are incompatible.', sections: [] };
  }
  const base = regionSections(a, b, radioFoundryRegionIdentity);
  const sections = base.sections.map((section) =>
    section.id === RADIOFOUNDRY_REGION.area2 ? toReported(section) : section,
  );
  sections.push(
    sidecarSection('info-reply', 'INFO reply', a, b, RADIOFOUNDRY_DEBUG_INFO_SIDECAR),
    sidecarSection('version-text', 'VERSION text', a, b, RADIOFOUNDRY_DEBUG_VERSION_SIDECAR),
    sidecarSection('iddb-reply', 'IDDB reply', a, b, RADIOFOUNDRY_DEBUG_IDDB_SIDECAR),
  );
  return { sections };
}

export const radioFoundryCompareAdapter: DebugCompareAdapter = {
  sections: radioFoundrySections,
  regionIdentity: (archive, id) => radioFoundryRegionIdentity(archive, id),
  notes: [
    {
      title: 'Byte compare only',
      text: 'Images are compared byte for byte. Decoded changes (channels, zones, contacts) are not shown for RadioFoundry yet.',
    },
  ],
};