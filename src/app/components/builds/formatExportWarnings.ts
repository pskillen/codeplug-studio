import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import type { MemberCapWarningKind } from '@core/import-export/exportWarning.ts';

export type { MemberCapWarningKind } from '@core/import-export/exportWarning.ts';

export interface WireNameShortening {
  original: string;
  exported: string;
  stillExceedsLimit: boolean;
  /** True when the name was disambiguated due to a collision with another exported name. */
  isCollision?: boolean;
}

export interface WireNameShorteningGroup {
  entityKind: string;
  title: string;
  maxLen: number;
  profileLabel?: string;
  items: WireNameShortening[];
}

export interface MemberCapItem {
  label: string;
  count: number;
  cap: number;
  truncatedFrom?: number;
}

export interface MemberCapGroup {
  kind: MemberCapWarningKind;
  title: string;
  cap: number;
  profileLabel?: string;
  items: MemberCapItem[];
}

export interface UnlinkedExportGroup {
  title: string;
  items: string[];
}

export interface FormattedExportWarnings {
  /** Warnings that are not folded into a named group (caps, cycles, etc.). */
  general: string[];
  /** Orphan / unlinked inclusion lines — folded as one accordion section. */
  unlinkedGroup: UnlinkedExportGroup | null;
  memberCapGroups: MemberCapGroup[];
  /** Real problems: still too long after shortening, or shortening disabled while over the limit. */
  shortenedProblemGroups: WireNameShorteningGroup[];
  /** Clean, successful shortens — no data loss, no conflict. Shown separately, never as a "warning." */
  shortenedInfoGroups: WireNameShorteningGroup[];
}

const UNLINKED_GROUP_TITLE = 'Export unlinked items';

const SHORTENED_GROUP_TITLES: Record<string, string> = {
  Channel: 'Channel names shortened',
  'Talk group': 'Talk group names shortened',
  Zone: 'Zone names shortened',
  'Scan list': 'Scan list names shortened',
  'RX group list': 'RX group list names shortened',
  Contact: 'Contact names shortened',
  'Wire name': 'Wire names shortened',
};

const COLLISION_GROUP_TITLES: Record<string, string> = {
  Channel: 'Channel name collisions',
  'Talk group': 'Talk group name collisions',
  Zone: 'Zone name collisions',
  'Scan list': 'Scan list name collisions',
  'RX group list': 'RX group list name collisions',
  Contact: 'Contact name collisions',
  'Wire name': 'Wire name collisions',
};

const MEMBER_CAP_GROUP_TITLES: Record<MemberCapWarningKind, string> = {
  'zone-expanded-scan-cap': 'Zones over scan member cap',
  'zone-expanded-cap': 'Zones over member cap',
  'zone-members-export': 'Zones over member cap',
  'zone-scan-list-truncated': 'Zone scan lists truncated',
  'scan-list-expanded-cap': 'Scan lists over member cap',
  'rx-group-list-members': 'RX group lists over member cap',
};

const SHORTENED_GROUP_ORDER = [
  'Channel',
  'Talk group',
  'Zone',
  'Scan list',
  'RX group list',
  'Contact',
  'Wire name',
] as const;

const MEMBER_CAP_GROUP_ORDER: MemberCapWarningKind[] = [
  'zone-expanded-scan-cap',
  'zone-expanded-cap',
  'zone-members-export',
  'zone-scan-list-truncated',
  'scan-list-expanded-cap',
  'rx-group-list-members',
];

function wireNameGroupKey(entityKind: string, maxLen: number, profileLabel?: string): string {
  return `${entityKind}\0${maxLen}\0${profileLabel ?? ''}`;
}

function memberCapGroupKey(kind: MemberCapWarningKind, cap: number, profileLabel?: string): string {
  return `${kind}\0${cap}\0${profileLabel ?? ''}`;
}

function wireNameGroupTitle(entityKind: string, isCollision = false): string {
  if (isCollision) {
    return COLLISION_GROUP_TITLES[entityKind] ?? `${entityKind} name collisions`;
  }
  return SHORTENED_GROUP_TITLES[entityKind] ?? `${entityKind} names shortened`;
}

function introForCollisionWireNameGroup(entityKind: string): string {
  return `The following ${entityKind.toLowerCase()} names collided with another exported name and were disambiguated:`;
}

function introForWireNameGroup(maxLen: number, profileLabel?: string): string {
  const profileSuffix = profileLabel ? ` of ${profileLabel}` : '';
  return `The following names were too long for the ${maxLen} character limit${profileSuffix} and were shortened on export:`;
}

function introForUnshortenedWireNameGroup(maxLen: number, profileLabel?: string): string {
  const profileSuffix = profileLabel ? ` of ${profileLabel}` : '';
  return `The following names exceed the ${maxLen} character limit${profileSuffix}:`;
}

export function memberCapGroupIntro(group: MemberCapGroup): string {
  const profileSuffix = group.profileLabel ? ` (${group.profileLabel})` : '';
  switch (group.kind) {
    case 'zone-scan-list-truncated':
      return `The following zone scan lists were truncated to the ${group.cap} member limit${profileSuffix} on export:`;
    case 'scan-list-expanded-cap':
      return `The following scan lists exceed the ${group.cap} member limit${profileSuffix} on export:`;
    case 'rx-group-list-members':
      return `The following RX group lists exceed the ${group.cap} member limit${profileSuffix} on export:`;
    case 'zone-expanded-scan-cap':
      return `The following zones exceed the ${group.cap} scan member limit${profileSuffix} on export:`;
    default:
      return `The following zones exceed the ${group.cap} member limit${profileSuffix} on export:`;
  }
}

export function memberCapItemLine(item: MemberCapItem, kind: MemberCapWarningKind): string {
  if (kind === 'zone-scan-list-truncated' && item.truncatedFrom != null) {
    return `"${item.label}" — ${item.truncatedFrom} → ${item.cap} members`;
  }
  return `"${item.label}" — ${item.count} members (cap ${item.cap})`;
}

function addMemberCapItem(
  groups: Map<string, MemberCapGroup>,
  kind: MemberCapWarningKind,
  cap: number,
  profileLabel: string | undefined,
  item: MemberCapItem,
): void {
  const key = memberCapGroupKey(kind, cap, profileLabel);
  const group = groups.get(key) ?? {
    kind,
    title: MEMBER_CAP_GROUP_TITLES[kind],
    cap,
    profileLabel,
    items: [],
  };
  group.items.push(item);
  groups.set(key, group);
}

function addWireNameShortening(
  groups: Map<string, WireNameShorteningGroup>,
  key: string,
  entityKind: string,
  maxLen: number,
  profileLabel: string | undefined,
  isCollision: boolean,
  item: WireNameShortening,
): void {
  const group = groups.get(key) ?? {
    entityKind,
    title: wireNameGroupTitle(entityKind, isCollision),
    maxLen,
    profileLabel,
    items: [],
  };
  group.items.push(item);
  groups.set(key, group);
}

/** Group structured `ExportWarning[]` into presentation sections — no text parsing. */
export function formatExportWarnings(warnings: ExportWarning[]): FormattedExportWarnings {
  const general: string[] = [];
  const unlinkedItems: string[] = [];
  const shortenedGroupsMap = new Map<string, WireNameShorteningGroup>();
  const memberCapGroupsMap = new Map<string, MemberCapGroup>();

  for (const warning of warnings) {
    switch (warning.kind) {
      case 'unlinked': {
        unlinkedItems.push(warning.message);
        break;
      }

      case 'member_cap': {
        addMemberCapItem(memberCapGroupsMap, warning.capKind, warning.cap, warning.profileLabel, {
          label: warning.label,
          count: warning.count,
          cap: warning.cap,
          truncatedFrom: warning.truncatedFrom,
        });
        break;
      }

      case 'wire_name': {
        if (warning.remediation === 'disambiguated') {
          const key = wireNameGroupKey(warning.entityKind, 0, 'collision');
          addWireNameShortening(shortenedGroupsMap, key, warning.entityKind, 0, undefined, true, {
            original: warning.original,
            exported: warning.exported,
            stillExceedsLimit: true,
            isCollision: true,
          });
          break;
        }

        const key = wireNameGroupKey(warning.entityKind, warning.limit, warning.profileLabel);
        addWireNameShortening(
          shortenedGroupsMap,
          key,
          warning.entityKind,
          warning.limit,
          warning.profileLabel,
          false,
          {
            original: warning.original,
            exported: warning.exported,
            stillExceedsLimit: warning.remediation !== 'shortened',
          },
        );
        break;
      }

      case 'general': {
        general.push(warning.message);
        break;
      }
    }
  }

  const memberCapGroups = [...memberCapGroupsMap.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => {
      const rankA = MEMBER_CAP_GROUP_ORDER.indexOf(a.kind);
      const rankB = MEMBER_CAP_GROUP_ORDER.indexOf(b.kind);
      if (rankA !== rankB) return rankA - rankB;
      if (a.cap !== b.cap) return a.cap - b.cap;
      return (a.profileLabel ?? '').localeCompare(b.profileLabel ?? '');
    });

  const shortenedGroups = [...shortenedGroupsMap.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => a.original.localeCompare(b.original)),
    }))
    .sort((a, b) => {
      const orderA = SHORTENED_GROUP_ORDER.indexOf(
        a.entityKind as (typeof SHORTENED_GROUP_ORDER)[number],
      );
      const orderB = SHORTENED_GROUP_ORDER.indexOf(
        b.entityKind as (typeof SHORTENED_GROUP_ORDER)[number],
      );
      const rankA = orderA === -1 ? SHORTENED_GROUP_ORDER.length : orderA;
      const rankB = orderB === -1 ? SHORTENED_GROUP_ORDER.length : orderB;
      if (rankA !== rankB) return rankA - rankB;
      if (a.maxLen !== b.maxLen) return a.maxLen - b.maxLen;
      return (a.profileLabel ?? '').localeCompare(b.profileLabel ?? '');
    });

  const shortenedProblemGroups: WireNameShorteningGroup[] = [];
  const shortenedInfoGroups: WireNameShorteningGroup[] = [];
  for (const group of shortenedGroups) {
    const problemItems = group.items.filter((item) => item.stillExceedsLimit);
    const infoItems = group.items.filter((item) => !item.stillExceedsLimit);
    if (problemItems.length > 0) {
      shortenedProblemGroups.push({ ...group, items: problemItems });
    }
    if (infoItems.length > 0) {
      shortenedInfoGroups.push({ ...group, items: infoItems });
    }
  }

  const unlinkedGroup: UnlinkedExportGroup | null =
    unlinkedItems.length > 0 ? { title: UNLINKED_GROUP_TITLE, items: unlinkedItems } : null;

  return {
    general,
    unlinkedGroup,
    memberCapGroups,
    shortenedProblemGroups,
    shortenedInfoGroups,
  };
}

export function wireNameShorteningIntro(group: WireNameShorteningGroup): string {
  if (group.items.every((item) => item.isCollision)) {
    return introForCollisionWireNameGroup(group.entityKind);
  }
  const hasOnlyUnshortened = group.items.every(
    (item) => item.stillExceedsLimit && item.exported === item.original && !item.isCollision,
  );
  return hasOnlyUnshortened
    ? introForUnshortenedWireNameGroup(group.maxLen, group.profileLabel)
    : introForWireNameGroup(group.maxLen, group.profileLabel);
}
