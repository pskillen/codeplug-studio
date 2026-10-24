/**
 * Published firmware releases. Studio bundles none: the release list and patches come from the firmware project's
 * public release index at run time (src/integrations/firmware-releases/), parsed and checked by
 * {@link parsePublishedReleaseIndex} and the published source. See docs/features/firmware-flashing/releases.md.
 * Never vendor firmware: release patches only.
 */
import type { FirmwareRadioId, KnownPatchedResult } from '../types.ts';
import type { PublishedFirmwareRelease } from './types.ts';

export {
  checkPublishedPatch,
  parsePublishedReleaseIndex,
  PUBLISHED_RELEASE_INDEX_FORMAT,
  type PublishedIndexOptions,
} from './publishedIndex.ts';

/** Result hashes of every published release for a radio, so stock resolution can say "this is already patched". */
export function listKnownPatchedResults(
  radioId: FirmwareRadioId,
  rows: readonly PublishedFirmwareRelease[],
): readonly KnownPatchedResult[] {
  return rows
    .filter((r) => r.radioId === radioId)
    .map((r) => ({ radioId: r.radioId, label: `release ${r.tag}`, sha256: r.resultSha256 }));
}
