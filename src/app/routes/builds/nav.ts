import { BuildCapabilityTrait } from '@core/models/traits.ts';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import { traitProfileFor } from '@core/models/traits.ts';

export interface BuildNavItem {
  label: string;
  path: string;
}

/** Secondary nav entries for a format build detail shell. */
export function buildNavItems(build: FormatBuild): BuildNavItem[] {
  const base = `/builds/${build.id}`;
  const traits = new Set(traitProfileFor(build.profileId)?.traits ?? []);

  const items: BuildNavItem[] = [{ label: 'Overview', path: `${base}/overview` }];

  if (traits.has(BuildCapabilityTrait.FlatMemoryList)) {
    items.push({ label: 'Memories', path: `${base}/memories` });
  }

  items.push({ label: 'Channels', path: `${base}/channels` });

  if (traits.has(BuildCapabilityTrait.ZoneGrouping)) {
    items.push({ label: 'Zones', path: `${base}/zones` });
  }

  items.push(
    { label: 'Talk groups', path: `${base}/talk-groups` },
    { label: 'Contacts', path: `${base}/contacts` },
    { label: 'RX group lists', path: `${base}/rx-group-lists` },
    { label: 'Export', path: `${base}/export` },
  );

  return items;
}

export function isBuildDetailPath(pathname: string): boolean {
  if (pathname === '/builds' || pathname === '/builds/new') return false;
  return /^\/builds\/[^/]+/.test(pathname);
}
