import {
  IconBinaryTree2,
  IconFileExport,
  IconPlane,
  IconPlugConnected,
  IconRadio,
  IconSettings,
} from '@tabler/icons-react';
import type { TablerIcon } from '@tabler/icons-react';
import { BuildCapabilityTrait } from '@core/models/traits.ts';
import type { EgressPath } from '@core/models/egressPath.ts';
import type { RadioBuild } from '@core/models/radioBuild.ts';
import {
  hasDedicatedScanLists,
  showsPerChannelScanListNav,
} from '@core/models/traits.ts';
import {
  defaultCompatibleEgress,
  radioTargetFor,
  traitsForRadioTarget,
} from '@core/radio-targets/index.ts';
import { entityNavIcons } from '../../nav/entityNavIcons.ts';

export interface BuildNavItem {
  label: string;
  path: string;
  icon: TablerIcon;
}

function navProfileId(build: RadioBuild, egressPaths?: EgressPath[]): string | undefined {
  return egressPaths?.[0]?.profileId ?? defaultCompatibleEgress(build.radioTargetId)?.profileId;
}

function navFormatIds(build: RadioBuild, egressPaths?: EgressPath[]): Set<string> {
  if (egressPaths && egressPaths.length > 0) {
    return new Set(egressPaths.map((path) => path.formatId));
  }
  const catalog = radioTargetFor(build.radioTargetId)?.compatibleEgress ?? [];
  return new Set(catalog.map((entry) => entry.formatId));
}

/** Secondary nav entries for a format build detail shell. */
export function buildNavItems(build: RadioBuild, egressPaths?: EgressPath[]): BuildNavItem[] {
  const base = `/builds/${build.id}`;
  const traits = new Set(traitsForRadioTarget(build.radioTargetId));
  const flatMemory = traits.has(BuildCapabilityTrait.FlatMemoryList);
  const profileId = navProfileId(build, egressPaths);
  const formatIds = navFormatIds(build, egressPaths);

  const items: BuildNavItem[] = [
    { label: 'Export', path: `${base}/export`, icon: IconFileExport },
    { label: 'Setup', path: `${base}/overview`, icon: IconSettings },
    {
      label: 'Radio characteristics',
      path: `${base}/characteristics`,
      icon: IconRadio,
    },
  ];

  items.push({ label: 'Channels', path: `${base}/channels`, icon: entityNavIcons.channels });

  if (profileId && showsPerChannelScanListNav(profileId)) {
    items.push({
      label: 'Scan list',
      path: `${base}/scan-list`,
      icon: entityNavIcons.scanLists,
    });
  }

  if (formatIds.has('anytone')) {
    items.push({ label: 'Airband', path: `${base}/airband`, icon: IconPlane });
  }

  if (traits.has(BuildCapabilityTrait.ZoneGrouping)) {
    items.push({ label: 'Zones', path: `${base}/zones`, icon: entityNavIcons.zones });
  }

  if (profileId && hasDedicatedScanLists(profileId)) {
    items.push({
      label: 'Scan lists',
      path: `${base}/scan-lists`,
      icon: entityNavIcons.scanLists,
    });
  }

  if (!flatMemory) {
    items.push(
      {
        label: 'Talk groups',
        path: `${base}/talk-groups`,
        icon: entityNavIcons.talkGroups,
      },
      { label: 'Contacts', path: `${base}/contacts`, icon: entityNavIcons.contacts },
      {
        label: 'RX group lists',
        path: `${base}/rx-group-lists`,
        icon: entityNavIcons.rxGroupLists,
      },
    );
  }

  items.push({
    label: 'Export resolution',
    path: `${base}/export-resolution`,
    icon: IconBinaryTree2,
  });

  if (formatIds.has('neonplug')) {
    items.push({
      label: 'NeonPlug settings',
      path: `${base}/neonplug-settings`,
      icon: IconPlugConnected,
    });
  }

  if (formatIds.has('radio-io')) {
    items.push({
      label: 'Radio image',
      path: `${base}/radio-image`,
      icon: IconPlugConnected,
    });
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
  toBuild: RadioBuild,
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
