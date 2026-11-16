import type {
  DebugIdentityArchive,
  DebugIdentityInput,
  DebugIdentityRows,
} from '../../debugView/index.ts';
import { RT95_IMAGE_SIZE } from './constants.ts';
import { RT95_CALIBRATION_REGION_ID, RT95_MMD1_REGION_ID } from './debugCapture.ts';

/** How much of the RT95 clone image the archive's programming-image entry covers. */
export function rt95CloneCoverage(archive: Pick<DebugIdentityArchive, 'manifest'>) {
  const region = archive.manifest.regions.find((item) => item.id === 'programming-image');
  const start = Math.min(RT95_IMAGE_SIZE, region?.address ?? 0);
  const end = Math.min(RT95_IMAGE_SIZE, (region?.address ?? 0) + (region?.byteLength ?? 0));
  const missing = [
    ...(start > 0 ? [{ start: 0, end: start - 1 }] : []),
    ...(end < RT95_IMAGE_SIZE ? [{ start: end, end: RT95_IMAGE_SIZE - 1 }] : []),
  ];
  const coverage: 'missing' | 'partial' | 'captured' =
    end <= start ? 'missing' : missing.length ? 'partial' : 'captured';
  return { region, missing, coverage };
}

/** Overview rows for the RT95: the archive manifest and the captured PC ident head. */
export function rt95IdentityRows({
  archive,
  connection,
  family,
}: DebugIdentityInput): DebugIdentityRows {
  const ident = archive?.sidecars['debug/ident.bin'];
  const coverage = archive ? rt95CloneCoverage(archive).coverage : undefined;
  return [
    ['Expected family', family],
    ['Serial · archive', archive?.manifest.serial || 'Unknown'],
    ['Firmware · archive', archive?.manifest.firmware || 'Unknown'],
    [
      'PC ident [head]',
      ident ? Array.from(ident, (b) => b.toString(16).padStart(2, '0')).join(' ') : 'Not captured',
    ],
    [
      'Clone channels/settings [unknown]',
      coverage === 'captured'
        ? 'Captured in programming image'
        : coverage === 'partial'
          ? 'Partially captured in programming image'
          : 'Not captured',
    ],
    ['Running firmware', 'Unknown'],
    ['Firmware mod', 'Unknown'],
    ['Evidence', archive ? 'Archive manifest' : 'No radio identity observed'],
    ['Connection', connection],
  ];
}

/** Hex and Compare region note for the RT95: whether a region is traced body bytes or unknown. */
export function rt95RegionNote(regionId: string) {
  return {
    tag:
      regionId === RT95_CALIBRATION_REGION_ID || regionId === RT95_MMD1_REGION_ID
        ? '[body]'
        : '[unknown]',
  };
}
