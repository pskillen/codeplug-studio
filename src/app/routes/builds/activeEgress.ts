import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';

const activeEgressStorageKey = (buildId: string) => `cps.activeEgress.${buildId}`;

export function readStoredActiveEgressId(buildId: string): string | null {
  try {
    return sessionStorage.getItem(activeEgressStorageKey(buildId));
  } catch {
    return null;
  }
}

export function writeStoredActiveEgressId(buildId: string, egressId: string): void {
  try {
    sessionStorage.setItem(activeEgressStorageKey(buildId), egressId);
  } catch {
    // sessionStorage unavailable — active selection is in-memory only
  }
}

/** Pick the active egress id from session preference, build default, or first path. */
export function resolveActiveEgressId(
  build: RadioBuild,
  egressPaths: EgressPath[],
  preferredId: string | null,
): string | null {
  if (egressPaths.length === 0) return null;
  if (preferredId && egressPaths.some((path) => path.id === preferredId)) {
    return preferredId;
  }
  if (
    build.defaultEgressPathId &&
    egressPaths.some((path) => path.id === build.defaultEgressPathId)
  ) {
    return build.defaultEgressPathId;
  }
  return egressPaths[0]?.id ?? null;
}

export function resolveActiveEgress(
  build: RadioBuild,
  egressPaths: EgressPath[],
  preferredId: string | null,
): EgressPath | null {
  const id = resolveActiveEgressId(build, egressPaths, preferredId);
  if (!id) return null;
  return egressPaths.find((path) => path.id === id) ?? null;
}
