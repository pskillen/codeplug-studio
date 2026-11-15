import { RT95_IMAGE_SIZE, RT95_MODEL_ID } from '@integrations/radio-io/radios/rt95/constants.ts';
import { createMemoryMap } from '@integrations/radio-io/kit/memoryMap.ts';
import { RT95_DESCRIPTOR } from '@integrations/radio-io/radios/rt95/descriptor.ts';
import { summariseRt95Clone } from '@integrations/radio-io/radios/rt95/cloneSummary.ts';
import {
  parseRadioBackupZip,
  type ParsedRadioBackupZip,
} from '@integrations/radio-io/backup/index.ts';
import { getRadioDescriptor } from '@integrations/radio-io/registry.ts';

/** The original bytes and each named region remain separate, including out-of-map regions. */
export interface DebugArchive extends ParsedRadioBackupZip {
  source: 'file' | 'live-read';
  zipBytes: Uint8Array;
}

export function openDebugArchive(bytes: Uint8Array, modelId: string): DebugArchive {
  const parsed = parseRadioBackupZip(bytes);
  const expected = getRadioDescriptor(modelId);
  if (!expected?.modelIds.includes(parsed.manifest.radioModelId)) {
    throw new Error(`Archive model ${parsed.manifest.radioModelId} does not match this profile.`);
  }
  return { ...parsed, source: 'file', zipBytes: bytes };
}

/** Gaps between captured ranges only; address spaces outside these bounds remain unknown. */
export function archiveGaps(regions: ParsedRadioBackupZip['manifest']['regions']) {
  const sorted = regions
    .filter((r) => r.byteLength > 0)
    .slice()
    .sort((a, b) => a.address - b.address);
  const gaps: { start: number; end: number }[] = [];
  let end = 0;
  for (const region of sorted) {
    if (end && region.address > end) gaps.push({ start: end, end: region.address - 1 });
    end = Math.max(end, region.address + region.byteLength);
  }
  return gaps;
}

/** Only the known programming-image entry can be mapped into RT95 clone address space. */
export function rt95ArchiveDetails(archive: DebugArchive) {
  if (archive.manifest.radioModelId !== RT95_MODEL_ID) return undefined;
  const region = archive.manifest.regions.find((item) => item.id === 'programming-image');
  const start = Math.min(RT95_IMAGE_SIZE, region?.address ?? 0);
  const end = Math.min(RT95_IMAGE_SIZE, (region?.address ?? 0) + (region?.byteLength ?? 0));
  const missing = [
    ...(start > 0 ? [{ start: 0, end: start - 1 }] : []),
    ...(end < RT95_IMAGE_SIZE ? [{ start: end, end: RT95_IMAGE_SIZE - 1 }] : []),
  ];
  if (start !== 0 || end !== RT95_IMAGE_SIZE) return { missing };
  try {
    const bytes = archive.regions[region!.id]!;
    const image = createMemoryMap(RT95_IMAGE_SIZE);
    image.set(0, bytes.subarray(0, RT95_IMAGE_SIZE));
    const bag = RT95_DESCRIPTOR.hydration.extractHydration(image, {
      sourceFileName: 'radio-backup:retevis-rt95',
      capturedAt: archive.manifest.capturedAt,
    });
    return { missing, summary: summariseRt95Clone(bag) };
  } catch {
    return { missing, summary: null };
  }
}
