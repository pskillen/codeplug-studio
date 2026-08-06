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
  traitsForRadioTarget,
} from '@core/radio-targets/index.ts';
import { usesAtD890AirbandBankSplit } from '@core/services/anytoneChannelBanks.ts';
import { findNeonplugDonorEgress, findRadioCloneEgress } from '../../lib/buildEgressUi.ts';
import { entityNavIcons } from '../../nav/entityNavIcons.ts';

export type BuildNavSection = 'overview' | 'export' | 'wire-preview' | 'audit';

export const BUILD_SECTION_OVERVIEW = 'Overview';
export const BUILD_SECTION_EXPORT = 'Export';
export const BUILD_SECTION_WIRE_PREVIEW = 'Wire preview';
export const BUILD_SECTION_ABOUT = 'About';

export interface BuildNavOptions {
  /** Seeded egress rows — retain links appear when a matching hydration bag exists. */
  egressPaths?: EgressPath[];
  /** Selected pathway — AM airband (and similar wire-only chrome) keys off this. */
  activeEgress?: EgressPath | null;
}

export interface BuildSectionNavItem {
  label: string;
  section: BuildNavSection;
  path: string;
  icon: TablerIcon;
}

export interface BuildWireEntityNavItem {
  label: string;
  path: string;
  icon: TablerIcon;
  /** First URL segment after `/builds/:id/` (e.g. `channels`). */
  segment: string;
}

export interface BuildAuditNavItem {
  label: string;
  path: string;
  icon: TablerIcon;
}

export interface BuildExportNavItem {
  label: string;
  path: string;
}

/** @deprecated Use section + entity nav — kept for tests that assert trait gating paths. */
export interface BuildNavItem {
  label: string;
  path: string;
  icon: TablerIcon;
}

/** Whether the build secondary nav should link to the D890 AM airband export page. */
export function showsD890AmAirbandNav(build: RadioBuild, options?: BuildNavOptions): boolean {
  if (usesAtD890AirbandBankSplit(options?.activeEgress?.profileId)) return true;
  if (build.radioTargetId !== 'anytone-at-d890uv') return false;
  return (options?.egressPaths ?? []).some((path) => usesAtD890AirbandBankSplit(path.profileId));
}

/** mk2 B2 — four peer sections in the contextual strip. */
export function buildSectionNavItems(build: RadioBuild): BuildSectionNavItem[] {
  const base = `/builds/${build.id}`;
  return [
    {
      label: BUILD_SECTION_OVERVIEW,
      section: 'overview',
      path: `${base}/overview`,
      icon: IconSettings,
    },
    {
      label: BUILD_SECTION_EXPORT,
      section: 'export',
      path: `${base}/export`,
      icon: IconFileExport,
    },
    {
      label: BUILD_SECTION_WIRE_PREVIEW,
      section: 'wire-preview',
      path: defaultWirePreviewPath(build),
      icon: entityNavIcons.channels,
    },
    {
      label: BUILD_SECTION_ABOUT,
      section: 'audit',
      path: `${base}/characteristics`,
      icon: IconRadio,
    },
  ];
}

/** mk2 Export section — pathway delivery vs projection settings. */
export function buildExportNavItems(build: RadioBuild): BuildExportNavItem[] {
  const base = `/builds/${build.id}`;
  return [
    { label: BUILD_SECTION_EXPORT, path: `${base}/export` },
    { label: 'Export settings', path: `${base}/export/settings` },
  ];
}

/** Trait-shaped wire entity chips — shown under Wire preview, not in the strip. */
export function buildWireEntityNavItems(
  build: RadioBuild,
  options?: BuildNavOptions,
): BuildWireEntityNavItem[] {
  const base = `/builds/${build.id}`;
  const traits = new Set(traitsForRadioTarget(build.radioTargetId));
  const flatMemory = traits.has(BuildCapabilityTrait.FlatMemoryList);

  const items: BuildWireEntityNavItem[] = [
    {
      label: 'Channels',
      path: `${base}/channels`,
      icon: entityNavIcons.channels,
      segment: 'channels',
    },
  ];

  if (showsPerChannelScanListNav(build.radioTargetId)) {
    items.push({
      label: 'Scan list',
      path: `${base}/scan-list`,
      icon: entityNavIcons.scanLists,
      segment: 'scan-list',
    });
  }

  if (showsD890AmAirbandNav(build, options)) {
    items.push({
      label: 'AM airband',
      path: `${base}/airband`,
      icon: IconPlane,
      segment: 'airband',
    });
  }

  if (traits.has(BuildCapabilityTrait.ZoneGrouping)) {
    items.push({
      label: 'Zones',
      path: `${base}/zones`,
      icon: entityNavIcons.zones,
      segment: 'zones',
    });
  }

  if (hasDedicatedScanLists(build.radioTargetId)) {
    items.push({
      label: 'Scan lists',
      path: `${base}/scan-lists`,
      icon: entityNavIcons.scanLists,
      segment: 'scan-lists',
    });
  }

  if (!flatMemory) {
    items.push(
      {
        label: 'Talk groups',
        path: `${base}/talk-groups`,
        icon: entityNavIcons.talkGroups,
        segment: 'talk-groups',
      },
      {
        label: 'Contacts',
        path: `${base}/contacts`,
        icon: entityNavIcons.contacts,
        segment: 'contacts',
      },
      {
        label: 'RX group lists',
        path: `${base}/rx-group-lists`,
        icon: entityNavIcons.rxGroupLists,
        segment: 'rx-group-lists',
      },
    );
  }

  return items;
}

/** mk2 About section — characteristics, export resolution, pathway retain viewers. */
export function buildAuditNavItems(
  build: RadioBuild,
  options?: BuildNavOptions,
): BuildAuditNavItem[] {
  const base = `/builds/${build.id}`;
  const egressPaths = options?.egressPaths ?? [];

  const items: BuildAuditNavItem[] = [
    {
      label: 'Radio characteristics',
      path: `${base}/characteristics`,
      icon: IconRadio,
    },
    {
      label: 'Export resolution',
      path: `${base}/export-resolution`,
      icon: IconBinaryTree2,
    },
  ];

  if (findNeonplugDonorEgress(egressPaths)) {
    items.push({
      label: 'NeonPlug settings',
      path: `${base}/neonplug-settings`,
      icon: IconPlugConnected,
    });
  }

  if (findRadioCloneEgress(egressPaths)) {
    items.push({
      label: 'Radio image',
      path: `${base}/radio-image`,
      icon: IconPlugConnected,
    });
  }

  return items;
}

/** Flat list of all detail paths — used when switching builds and legacy tests. */
export function buildNavItems(build: RadioBuild, options?: BuildNavOptions): BuildNavItem[] {
  const sections = buildSectionNavItems(build);
  const wire = buildWireEntityNavItems(build, options);
  const audit = buildAuditNavItems(build, options);

  const items: BuildNavItem[] = [
    { label: sections[1].label, path: sections[1].path, icon: sections[1].icon },
    { label: sections[0].label, path: sections[0].path, icon: sections[0].icon },
    ...audit.slice(0, 1).map((item) => ({
      label: item.label,
      path: item.path,
      icon: item.icon,
    })),
    ...wire.map((item) => ({ label: item.label, path: item.path, icon: item.icon })),
    ...audit.slice(1).map((item) => ({
      label: item.label,
      path: item.path,
      icon: item.icon,
    })),
  ];

  return items;
}

export function defaultWirePreviewPath(build: RadioBuild, options?: BuildNavOptions): string {
  const wire = buildWireEntityNavItems(build, options);
  return wire[0]?.path ?? `/builds/${build.id}/channels`;
}

export function allBuildDetailPaths(build: RadioBuild, options?: BuildNavOptions): string[] {
  const base = `/builds/${build.id}`;
  const paths = new Set<string>([
    `${base}/export`,
    `${base}/overview`,
    ...buildWireEntityNavItems(build, options).map((item) => item.path),
    `${base}/channels/bulk`,
    ...buildAuditNavItems(build, options).map((item) => item.path),
  ]);
  return [...paths];
}

const WIRE_PREVIEW_SEGMENTS = new Set([
  'channels',
  'scan-list',
  'airband',
  'zones',
  'scan-lists',
  'talk-groups',
  'contacts',
  'rx-group-lists',
]);

const AUDIT_SEGMENTS = new Set([
  'characteristics',
  'export-resolution',
  'neonplug-settings',
  'radio-image',
]);

export function activeBuildSection(pathname: string, buildId: string): BuildNavSection | null {
  const prefix = `/builds/${buildId}/`;
  if (!pathname.startsWith(prefix)) return null;

  const suffix = pathname.slice(prefix.length);
  if (!suffix || suffix === 'export') return 'export';
  if (suffix === 'export/settings' || suffix.startsWith('export/settings/')) return 'export';
  if (suffix === 'overview' || suffix.startsWith('overview/')) return 'overview';

  const firstSegment = suffix.split('/')[0];
  if (firstSegment && WIRE_PREVIEW_SEGMENTS.has(firstSegment)) return 'wire-preview';
  if (firstSegment && AUDIT_SEGMENTS.has(firstSegment)) return 'audit';

  return null;
}

export function activeBuildSectionLabel(pathname: string, buildId: string): string | null {
  const section = activeBuildSection(pathname, buildId);
  if (!section) return null;
  switch (section) {
    case 'overview':
      return BUILD_SECTION_OVERVIEW;
    case 'export':
      return BUILD_SECTION_EXPORT;
    case 'wire-preview':
      return BUILD_SECTION_WIRE_PREVIEW;
    case 'audit':
      return BUILD_SECTION_ABOUT;
  }
}

export function activeExportNavItem(
  pathname: string,
  buildId: string,
  items: readonly BuildExportNavItem[],
): BuildExportNavItem | null {
  const prefix = `/builds/${buildId}/`;
  if (!pathname.startsWith(prefix)) return null;

  let best: BuildExportNavItem | null = null;
  for (const item of items) {
    if (pathname === item.path || pathname.startsWith(`${item.path}/`)) {
      if (!best || item.path.length > best.path.length) best = item;
    }
  }
  return best;
}

export function activeWireEntityNavItem(
  pathname: string,
  buildId: string,
  items: readonly BuildWireEntityNavItem[],
): BuildWireEntityNavItem | null {
  const prefix = `/builds/${buildId}/`;
  if (!pathname.startsWith(prefix)) return null;

  let best: BuildWireEntityNavItem | null = null;
  for (const item of items) {
    if (pathname === item.path || pathname.startsWith(`${item.path}/`)) {
      if (!best || item.path.length > best.path.length) best = item;
    }
  }
  return best;
}

export function activeAuditNavItem(
  pathname: string,
  buildId: string,
  items: readonly BuildAuditNavItem[],
): BuildAuditNavItem | null {
  const prefix = `/builds/${buildId}/`;
  if (!pathname.startsWith(prefix)) return null;

  let best: BuildAuditNavItem | null = null;
  for (const item of items) {
    if (pathname === item.path || pathname.startsWith(`${item.path}/`)) {
      if (!best || item.path.length > best.path.length) best = item;
    }
  }
  return best;
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
  options?: BuildNavOptions,
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

  const navPaths = new Set(allBuildDetailPaths(toBuild, options));
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
