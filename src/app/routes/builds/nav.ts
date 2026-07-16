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

  const items: BuildNavItem[] = [{ label: 'Overview', path: `${base}/overview` }];

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

  items.push({ label: 'Export', path: `${base}/export` });
  items.push({ label: 'Export resolution', path: `${base}/export-resolution` });

  return items;
}

export function isBuildDetailPath(pathname: string): boolean {
  if (pathname === '/builds' || pathname === '/builds/new') return false;
  return /^\/builds\/[^/]+/.test(pathname);
}
