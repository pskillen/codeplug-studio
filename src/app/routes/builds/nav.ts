import { BuildCapabilityTrait } from '@core/models/traits.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import { hasDedicatedScanLists, traitProfileFor } from '@core/models/traits.ts';

export interface BuildNavItem {
  label: string;
  path: string;
}

/** Secondary nav entries for a format build detail shell. */
export function buildNavItems(build: FormatBuild): BuildNavItem[] {
  const base = `/builds/${build.id}`;
  const traits = new Set(traitProfileFor(build.profileId)?.traits ?? []);
  const flatMemory = traits.has(BuildCapabilityTrait.FlatMemoryList);

  const items: BuildNavItem[] = [
    { label: 'Export', path: `${base}/export` },
    { label: 'Setup', path: `${base}/overview` },
    { label: 'Radio characteristics', path: `${base}/characteristics` },
  ];

  items.push({ label: 'Channels', path: `${base}/channels` });

  if (build.formatId === 'anytone') {
    items.push({ label: 'Airband', path: `${base}/airband` });
  }

  if (traits.has(BuildCapabilityTrait.ZoneGrouping)) {
    items.push({ label: 'Zones', path: `${base}/zones` });
  }

  if (hasDedicatedScanLists(build.profileId)) {
    items.push({ label: 'Scan lists', path: `${base}/scan-lists` });
  }

  if (!flatMemory) {
    items.push(
      { label: 'Talk groups', path: `${base}/talk-groups` },
      { label: 'Contacts', path: `${base}/contacts` },
      { label: 'RX group lists', path: `${base}/rx-group-lists` },
    );
  }

  items.push({ label: 'Export resolution', path: `${base}/export-resolution` });

  if (build.profileId === 'neonplug-dm32uv') {
    items.push({ label: 'NeonPlug settings', path: `${base}/neonplug-settings` });
  }

  return items;
}

export function isBuildDetailPath(pathname: string): boolean {
  if (pathname === '/builds' || pathname === '/builds/new') return false;
  return /^\/builds\/[^/]+/.test(pathname);
}

/**
 * When switching builds, keep the current sub-route when the target build
 * exposes it in secondary nav; otherwise land on Export.
 */
export function pathForSwitchedBuild(
  pathname: string,
  fromBuildId: string,
  toBuild: FormatBuild,
): string {
  const base = `/builds/${toBuild.id}`;
  const prefix = `/builds/${fromBuildId}/`;
  if (!pathname.startsWith(prefix)) {
    return `${base}/export`;
  }

  const suffix = pathname.slice(prefix.length);
  if (!suffix) {
    return `${base}/export`;
  }

  const navPaths = new Set(buildNavItems(toBuild).map((item) => item.path));
  const exact = `${base}/${suffix}`;
  if (navPaths.has(exact)) {
    return exact;
  }

  const firstSegment = suffix.split('/')[0];
  if (firstSegment) {
    const parent = `${base}/${firstSegment}`;
    if (navPaths.has(parent)) {
      return parent;
    }
  }

  return `${base}/export`;
}
