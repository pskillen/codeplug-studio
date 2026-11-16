import { OPENGD77_SENSITIVE_SPANS } from '@core/radios/opengd77/settings.ts';
import type { DebugSensitiveArchive, DebugSensitiveRange } from '../../debugSensitive.ts';
import { OPENGD77_BACKUP_FLASH_SPANS } from './backupRestoreRoles.ts';
import { openGd77DebugModel } from './debugCoverage.ts';

/**
 * Password bytes in an OpenGD77 debug archive: the codeplug `prgPwd` (0x100, 8 bytes) and the boot
 * PIN (0x751C, 3 bytes), at their flash address inside the FLASH span region that holds them. The
 * boot-password enable flag is shown plain. Nothing for another radio's archive or for a region
 * that is not a captured FLASH span.
 */
export function openGd77ArchiveSensitiveRanges(
  archive: DebugSensitiveArchive,
  regionId: string,
): readonly DebugSensitiveRange[] {
  if (!openGd77DebugModel(archive.manifest.radioModelId)) return [];
  if (!OPENGD77_BACKUP_FLASH_SPANS.some((s) => s.id === regionId)) return [];
  const region = archive.manifest.regions.find((r) => r.id === regionId);
  const bytes = archive.regions[regionId];
  if (!region || !bytes) return [];
  const end = region.address + bytes.length;
  return OPENGD77_SENSITIVE_SPANS.flatMap((span) =>
    span.abs >= region.address && span.abs + span.length <= end
      ? [{ start: span.abs, end: span.abs + span.length, label: span.label }]
      : [],
  );
}
