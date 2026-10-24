/**
 * Firmware projects that publish release patches, keyed by the patch `name`. Holds the operator-facing name the
 * wizard and the flash summary show for a release ("MM9PDY modded firmware 1.0.0"). A new radio's project gets a
 * row here alongside its patch format; the wizard picks the name up with no app change.
 */
import type { LoadedFirmwarePatch } from './types.ts';

export interface FirmwareProject {
  /** Patch `name` value, e.g. 'baofeng-dm32-firmware'. */
  readonly patchName: string;
  /** Operator-facing name, used ahead of the version: 'MM9PDY modded firmware'. */
  readonly displayName: string;
}

export const FIRMWARE_PROJECTS: readonly FirmwareProject[] = [
  { patchName: 'baofeng-dm32-firmware', displayName: 'MM9PDY modded firmware' },
  { patchName: 'anytone-d890-firmware', displayName: 'MM9PDY modded firmware' },
];

/** Shown for a patch whose `name` is not a known project. User patches are refused before this in practice. */
export const UNKNOWN_FIRMWARE_PROJECT_NAME = 'Firmware patch';

export function firmwareProjectDisplayName(
  patchName: string | undefined,
  projects: readonly FirmwareProject[] = FIRMWARE_PROJECTS,
): string {
  return (
    projects.find((p) => p.patchName === patchName)?.displayName ?? UNKNOWN_FIRMWARE_PROJECT_NAME
  );
}

/** 'MM9PDY modded firmware 1.0.0'. */
export function firmwareReleaseTitle(patchName: string | undefined, version: string): string {
  return `${firmwareProjectDisplayName(patchName)} ${version}`;
}

/** 'stock firmware v1.01.048'. */
export function stockFirmwareTitle(version: string): string {
  return `stock firmware ${version}`;
}

/** 'MM9PDY modded firmware 1.0.0' for a loaded patch: its published release when matched, else its own name and version. */
export function loadedFirmwarePatchTitle(loaded: LoadedFirmwarePatch): string {
  if (loaded.release) return firmwareReleaseTitle(loaded.release.patchName, loaded.release.tag);
  const { name, version } = loaded.parsed.description;
  return firmwareReleaseTitle(name, version);
}
