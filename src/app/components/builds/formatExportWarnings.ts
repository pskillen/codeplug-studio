export interface WireNameShortening {
  original: string;
  exported: string;
  stillExceedsLimit: boolean;
}

export interface WireNameShorteningGroup {
  entityKind: string;
  title: string;
  maxLen: number;
  profileLabel?: string;
  items: WireNameShortening[];
}

export type MemberCapWarningKind =
  | 'zone-expanded-scan-cap'
  | 'zone-expanded-cap'
  | 'zone-members-export'
  | 'zone-scan-list-truncated'
  | 'scan-list-expanded-cap'
  | 'rx-group-list-members';

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
  shortenedGroups: WireNameShorteningGroup[];
}

const UNLINKED_EXPORT_RE =
  /^Including \d+ (?:channel|talk group|RX group list|digital contact|analog contact)\(s\) not (?:linked to a zone|referenced by a channel)$/;

const UNLINKED_GROUP_TITLE = 'Export unlinked items';

const SHORTENED_EXPORTED_RE =
  /^(.+?) wire name "(.+)" exceeds (\d+) characters(?: for (.+?))?; exported as "(.+)"$/;

const SHORTENED_STILL_TOO_LONG_RE =
  /^(.+?) wire name "(.+)" exceeds (\d+) characters(?: for (.+?))?; shortened to "(.+)" still exceeds limit$/;

const UNSHORTENED_OVER_LIMIT_RE =
  /^(.+?) wire name "(.+)" exceeds (\d+) characters(?: for (.+?))?$/;

const ZONE_EXPANDED_SCAN_CAP_RE = /^Zone "(.+)" has (\d+) expanded members \(scan cap (\d+)\)$/;

const ZONE_EXPANDED_CAP_RE = /^Zone "(.+)" has (\d+) expanded members \(cap (\d+)\)$/;

const ZONE_MEMBERS_EXPORT_RE = /^Zone "(.+)" has (\d+) members; only (\d+) export to (.+)$/;

const ZONE_SCAN_LIST_TRUNCATED_RE = /^Zone "(.+)" scan list truncated from (\d+) to (\d+) members$/;

const SCAN_LIST_EXPANDED_CAP_RE = /^Scan list "(.+)" has (\d+) expanded members \(cap (\d+)\)$/;

const RX_GROUP_LIST_MEMBERS_RE =
  /^RX group list "(.+)" has (\d+) members; only (\d+) export to (.+)$/;

const SHORTENED_GROUP_TITLES: Record<string, string> = {
  Channel: 'Channel names shortened',
  'Talk group': 'Talk group names shortened',
  Zone: 'Zone names shortened',
  'Scan list': 'Scan list names shortened',
  'RX group list': 'RX group list names shortened',
  Contact: 'Contact names shortened',
  'Wire name': 'Wire names shortened',
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

function wireNameGroupTitle(entityKind: string): string {
  return SHORTENED_GROUP_TITLES[entityKind] ?? `${entityKind} names shortened`;
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

/** Split raw export warning strings into grouped presentation sections. */
export function formatExportWarnings(warnings: string[]): FormattedExportWarnings {
  const general: string[] = [];
  const unlinkedItems: string[] = [];
  const shortenedGroupsMap = new Map<string, WireNameShorteningGroup>();
  const memberCapGroupsMap = new Map<string, MemberCapGroup>();

  for (const warning of warnings) {
    if (UNLINKED_EXPORT_RE.test(warning)) {
      unlinkedItems.push(warning);
      continue;
    }

    const zoneScanCap = warning.match(ZONE_EXPANDED_SCAN_CAP_RE);
    if (zoneScanCap) {
      const [, label, countText, capText] = zoneScanCap;
      addMemberCapItem(memberCapGroupsMap, 'zone-expanded-scan-cap', Number(capText), undefined, {
        label: label!,
        count: Number(countText),
        cap: Number(capText),
      });
      continue;
    }

    const zoneExpandedCap = warning.match(ZONE_EXPANDED_CAP_RE);
    if (zoneExpandedCap) {
      const [, label, countText, capText] = zoneExpandedCap;
      addMemberCapItem(memberCapGroupsMap, 'zone-expanded-cap', Number(capText), undefined, {
        label: label!,
        count: Number(countText),
        cap: Number(capText),
      });
      continue;
    }

    const zoneMembersExport = warning.match(ZONE_MEMBERS_EXPORT_RE);
    if (zoneMembersExport) {
      const [, label, countText, capText, profileLabel] = zoneMembersExport;
      addMemberCapItem(memberCapGroupsMap, 'zone-members-export', Number(capText), profileLabel, {
        label: label!,
        count: Number(countText),
        cap: Number(capText),
      });
      continue;
    }

    const zoneScanTruncated = warning.match(ZONE_SCAN_LIST_TRUNCATED_RE);
    if (zoneScanTruncated) {
      const [, label, fromText, capText] = zoneScanTruncated;
      addMemberCapItem(memberCapGroupsMap, 'zone-scan-list-truncated', Number(capText), undefined, {
        label: label!,
        count: Number(capText),
        cap: Number(capText),
        truncatedFrom: Number(fromText),
      });
      continue;
    }

    const scanListCap = warning.match(SCAN_LIST_EXPANDED_CAP_RE);
    if (scanListCap) {
      const [, label, countText, capText] = scanListCap;
      addMemberCapItem(memberCapGroupsMap, 'scan-list-expanded-cap', Number(capText), undefined, {
        label: label!,
        count: Number(countText),
        cap: Number(capText),
      });
      continue;
    }

    const rxGroupListCap = warning.match(RX_GROUP_LIST_MEMBERS_RE);
    if (rxGroupListCap) {
      const [, label, countText, capText, profileLabel] = rxGroupListCap;
      addMemberCapItem(memberCapGroupsMap, 'rx-group-list-members', Number(capText), profileLabel, {
        label: label!,
        count: Number(countText),
        cap: Number(capText),
      });
      continue;
    }

    const shortened = warning.match(SHORTENED_EXPORTED_RE);
    if (shortened) {
      const [, entityKind, original, maxLenText, profileLabel, exported] = shortened;
      const maxLen = Number(maxLenText);
      const key = wireNameGroupKey(entityKind!, maxLen, profileLabel);
      const group = shortenedGroupsMap.get(key) ?? {
        entityKind: entityKind!,
        title: wireNameGroupTitle(entityKind!),
        maxLen,
        profileLabel,
        items: [],
      };
      group.items.push({ original: original!, exported: exported!, stillExceedsLimit: false });
      shortenedGroupsMap.set(key, group);
      continue;
    }

    const stillTooLong = warning.match(SHORTENED_STILL_TOO_LONG_RE);
    if (stillTooLong) {
      const [, entityKind, original, maxLenText, profileLabel, exported] = stillTooLong;
      const maxLen = Number(maxLenText);
      const key = wireNameGroupKey(entityKind!, maxLen, profileLabel);
      const group = shortenedGroupsMap.get(key) ?? {
        entityKind: entityKind!,
        title: wireNameGroupTitle(entityKind!),
        maxLen,
        profileLabel,
        items: [],
      };
      group.items.push({ original: original!, exported: exported!, stillExceedsLimit: true });
      shortenedGroupsMap.set(key, group);
      continue;
    }

    const overLimit = warning.match(UNSHORTENED_OVER_LIMIT_RE);
    if (overLimit) {
      const [, entityKind, original, maxLenText, profileLabel] = overLimit;
      const maxLen = Number(maxLenText);
      const key = wireNameGroupKey(entityKind!, maxLen, profileLabel);
      const group = shortenedGroupsMap.get(key) ?? {
        entityKind: entityKind!,
        title: wireNameGroupTitle(entityKind!),
        maxLen,
        profileLabel,
        items: [],
      };
      group.items.push({ original: original!, exported: original!, stillExceedsLimit: true });
      shortenedGroupsMap.set(key, group);
      continue;
    }

    general.push(warning);
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

  const unlinkedGroup: UnlinkedExportGroup | null =
    unlinkedItems.length > 0 ? { title: UNLINKED_GROUP_TITLE, items: unlinkedItems } : null;

  return { general, unlinkedGroup, memberCapGroups, shortenedGroups };
}

export function wireNameShorteningIntro(group: WireNameShorteningGroup): string {
  const hasOnlyUnshortened = group.items.every(
    (item) => item.stillExceedsLimit && item.exported === item.original,
  );
  return hasOnlyUnshortened
    ? introForUnshortenedWireNameGroup(group.maxLen, group.profileLabel)
    : introForWireNameGroup(group.maxLen, group.profileLabel);
}
