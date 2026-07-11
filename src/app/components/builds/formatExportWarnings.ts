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

export interface FormattedExportWarnings {
  general: string[];
  shortenedGroups: WireNameShorteningGroup[];
}

const SHORTENED_EXPORTED_RE =
  /^(.+?) wire name "(.+)" exceeds (\d+) characters(?: for (.+?))?; exported as "(.+)"$/;

const SHORTENED_STILL_TOO_LONG_RE =
  /^(.+?) wire name "(.+)" exceeds (\d+) characters(?: for (.+?))?; shortened to "(.+)" still exceeds limit$/;

const UNSHORTENED_OVER_LIMIT_RE =
  /^(.+?) wire name "(.+)" exceeds (\d+) characters(?: for (.+?))?$/;

const SHORTENED_GROUP_TITLES: Record<string, string> = {
  Channel: 'Channel names shortened',
  'Talk group': 'Talk group names shortened',
  Zone: 'Zone names shortened',
  'Scan list': 'Scan list names shortened',
  'RX group list': 'RX group list names shortened',
  Contact: 'Contact names shortened',
  'Wire name': 'Wire names shortened',
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

function groupKey(entityKind: string, maxLen: number, profileLabel?: string): string {
  return `${entityKind}\0${maxLen}\0${profileLabel ?? ''}`;
}

function groupTitle(entityKind: string): string {
  return SHORTENED_GROUP_TITLES[entityKind] ?? `${entityKind} names shortened`;
}

function introForGroup(maxLen: number, profileLabel?: string): string {
  const profileSuffix = profileLabel ? ` of ${profileLabel}` : '';
  return `The following names were too long for the ${maxLen} character limit${profileSuffix} and were shortened on export:`;
}

function introForUnshortenedGroup(maxLen: number, profileLabel?: string): string {
  const profileSuffix = profileLabel ? ` of ${profileLabel}` : '';
  return `The following names exceed the ${maxLen} character limit${profileSuffix}:`;
}

/** Split raw export warning strings into general messages and grouped wire-name shortenings. */
export function formatExportWarnings(warnings: string[]): FormattedExportWarnings {
  const general: string[] = [];
  const groups = new Map<string, WireNameShorteningGroup>();

  for (const warning of warnings) {
    const shortened = warning.match(SHORTENED_EXPORTED_RE);
    if (shortened) {
      const [, entityKind, original, maxLenText, profileLabel, exported] = shortened;
      const maxLen = Number(maxLenText);
      const key = groupKey(entityKind!, maxLen, profileLabel);
      const group = groups.get(key) ?? {
        entityKind: entityKind!,
        title: groupTitle(entityKind!),
        maxLen,
        profileLabel,
        items: [],
      };
      group.items.push({ original: original!, exported: exported!, stillExceedsLimit: false });
      groups.set(key, group);
      continue;
    }

    const stillTooLong = warning.match(SHORTENED_STILL_TOO_LONG_RE);
    if (stillTooLong) {
      const [, entityKind, original, maxLenText, profileLabel, exported] = stillTooLong;
      const maxLen = Number(maxLenText);
      const key = groupKey(entityKind!, maxLen, profileLabel);
      const group = groups.get(key) ?? {
        entityKind: entityKind!,
        title: groupTitle(entityKind!),
        maxLen,
        profileLabel,
        items: [],
      };
      group.items.push({ original: original!, exported: exported!, stillExceedsLimit: true });
      groups.set(key, group);
      continue;
    }

    const overLimit = warning.match(UNSHORTENED_OVER_LIMIT_RE);
    if (overLimit) {
      const [, entityKind, original, maxLenText, profileLabel] = overLimit;
      const maxLen = Number(maxLenText);
      const key = groupKey(entityKind!, maxLen, profileLabel);
      const group = groups.get(key) ?? {
        entityKind: entityKind!,
        title: groupTitle(entityKind!),
        maxLen,
        profileLabel,
        items: [],
      };
      group.items.push({ original: original!, exported: original!, stillExceedsLimit: true });
      groups.set(key, group);
      continue;
    }

    general.push(warning);
  }

  const shortenedGroups = [...groups.values()]
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

  return { general, shortenedGroups };
}

export function wireNameShorteningIntro(group: WireNameShorteningGroup): string {
  const hasOnlyUnshortened = group.items.every(
    (item) => item.stillExceedsLimit && item.exported === item.original,
  );
  return hasOnlyUnshortened
    ? introForUnshortenedGroup(group.maxLen, group.profileLabel)
    : introForGroup(group.maxLen, group.profileLabel);
}
