import {
  decodeUv5rMiniFullRead,
  UV5R_MINI_DEBUG_FRAMES,
  UV5R_MINI_DEBUG_LOG_SECTORS,
  UV5R_MINI_DEBUG_SPANS,
  UV5R_MINI_F_REPLY_LENGTH,
  UV5R_MINI_FULL_READ_SIZE,
  UV5R_MINI_M_REPLY_LENGTH,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import { uv17ProBackupMemSpans } from '@integrations/radio-io/radios/uv17pro-family/backupRestoreRoles.ts';
import { UV5R_MINI_LAYOUT } from '@integrations/radio-io/radios/uv17pro-family/layout.ts';
import {
  decodeUv5rMiniRadioReport,
  UV5RMINI_RADIO_REPORT_ADDRESS,
  UV5RMINI_RADIO_REPORT_LENGTH,
} from '@core/radios/baofeng/uv-5r-mini/radioReport.ts';
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
  if (parsed.manifest.radioModelId === 'UV-5R Mini' && parsed.regions.clone) {
    const region = parsed.manifest.regions.find((item) => item.id === 'clone');
    const wire = parsed.sidecars['debug/wire.bin'];
    const decoded = parsed.regions.clone;
    const f = parsed.sidecars['debug/f.bin'];
    const m = parsed.sidecars['debug/m.bin'];
    if (
      region?.address !== 0 ||
      region.byteLength !== UV5R_MINI_FULL_READ_SIZE ||
      region.restoreRole !== 'inspect-only' ||
      wire?.length !== UV5R_MINI_FULL_READ_SIZE ||
      decoded.length !== UV5R_MINI_FULL_READ_SIZE ||
      f?.length !== UV5R_MINI_F_REPLY_LENGTH ||
      m?.length !== UV5R_MINI_M_REPLY_LENGTH ||
      !decodeUv5rMiniFullRead(wire).every((byte, i) => byte === decoded[i])
    ) {
      throw new Error('Invalid Mini debug capture representations or replies.');
    }
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

/** Map Mini backup MEM entries from packed offsets to clone addresses; leave unknown entries alone. */
export function uv5rMiniArchiveDetails(archive: DebugArchive) {
  if (archive.manifest.radioModelId !== 'UV-5R Mini') return undefined;
  const spans = uv17ProBackupMemSpans(UV5R_MINI_LAYOUT);
  const mm9pdyData = UV5R_MINI_DEBUG_SPANS.find((span) => span.id === 'c000');
  const ranges = archive.manifest.regions.flatMap((region) => {
    const span = spans.find(
      (s) => s.id === region.id && s.packedOffset === region.address && region.byteLength <= s.size,
    );
    if (span) return [{ start: span.radioAddr, end: span.radioAddr + region.byteLength }];
    if (
      region.id === 'zones' &&
      mm9pdyData &&
      region.address === mm9pdyData.start &&
      region.byteLength <= mm9pdyData.end - mm9pdyData.start
    )
      return [{ start: mm9pdyData.start, end: mm9pdyData.start + region.byteLength }];
    if (
      region.id === 'clone' &&
      region.address === 0 &&
      region.byteLength === UV5R_MINI_FULL_READ_SIZE &&
      region.restoreRole === 'inspect-only'
    )
      return [{ start: 0, end: UV5R_MINI_FULL_READ_SIZE }];
    return [];
  });
  const sections = [
    ...[...UV5R_MINI_DEBUG_SPANS, ...UV5R_MINI_DEBUG_LOG_SECTORS].sort((x, y) => x.start - y.start),
    ...UV5R_MINI_DEBUG_FRAMES,
  ].map((span) => [span.label, span.start, span.end] as const);
  const coverage = sections.flatMap(([label, start, end]) => {
    const boundaries = [
      ...new Set([
        start,
        end,
        ...ranges.flatMap((r) => [
          Math.max(start, Math.min(end, r.start)),
          Math.max(start, Math.min(end, r.end)),
        ]),
      ]),
    ].sort((a, b) => a - b);
    return boundaries.slice(0, -1).map((a, i) => ({
      label,
      start: a,
      end: boundaries[i + 1]! - 1,
      captured: ranges.some((r) => r.start <= a && r.end >= boundaries[i + 1]!),
    }));
  });
  const decoded = archive.source === 'live-read' ? archive.regions.clone : undefined;
  const report =
    decoded?.length === UV5R_MINI_FULL_READ_SIZE
      ? decodeUv5rMiniRadioReport(
          decoded.subarray(
            UV5RMINI_RADIO_REPORT_ADDRESS,
            UV5RMINI_RADIO_REPORT_ADDRESS + UV5RMINI_RADIO_REPORT_LENGTH,
          ),
        )
      : undefined;
  return { coverage, report: report?.kind === 'report' ? report : undefined };
}
