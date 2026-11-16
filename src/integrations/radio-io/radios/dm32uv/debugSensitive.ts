import type { DebugSensitiveArchive, DebugSensitiveRange } from '../../debugSensitive.ts';
import { DM32_METADATA, DM32_MODEL_IDS } from './constants.ts';
import { buildDm32SparseCapture } from './debugMemory.ts';
import { dm32PageByStoredTag } from './debugMemoryLists.ts';
import { DM32_SETTINGS_FIELDS } from './debugMemorySettings.ts';

/**
 * Password bytes in a DM-32 debug archive: the power-on, write and read passwords (settings
 * offsets 0x431-0x438, 0x43B-0x442, 0x443-0x44A) of the single `0x04` page, at the address the
 * page was captured at. The password-set flags are shown plain. Nothing when that page is absent
 * or ambiguous, or lies outside the region asked about.
 */
export function dm32ArchiveSensitiveRanges(
  archive: DebugSensitiveArchive,
  regionId: string,
): readonly DebugSensitiveRange[] {
  if (!(DM32_MODEL_IDS as readonly string[]).includes(archive.manifest.radioModelId)) return [];
  const region = archive.manifest.regions.find((r) => r.id === regionId);
  const bytes = archive.regions[regionId];
  if (!region || !bytes) return [];
  const lookup = dm32PageByStoredTag(buildDm32SparseCapture(archive), DM32_METADATA.VFO_SETTINGS);
  if (lookup.kind !== 'page') return [];
  const end = region.address + bytes.length;
  return DM32_SETTINGS_FIELDS.filter((field) => field.sensitive).flatMap((field) => {
    const start = lookup.address + field.offset;
    return start >= region.address && start + field.length <= end
      ? [{ start, end: start + field.length, label: field.label }]
      : [];
  });
}
