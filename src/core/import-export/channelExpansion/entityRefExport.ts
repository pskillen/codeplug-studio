import type { DigitalContact, TalkGroup } from '@core/models/library.ts';
import type { EntityRef } from '@core/models/libraryTypes.ts';

export function findTalkGroupById(id: string, talkGroups: TalkGroup[]): TalkGroup | null {
  return talkGroups.find((tg) => tg.id === id) ?? null;
}

export function findDigitalContactById(
  id: string,
  contacts: DigitalContact[],
): DigitalContact | null {
  return contacts.find((c) => c.id === id) ?? null;
}

export function entityRefDisplayName(
  ref: EntityRef,
  talkGroups: TalkGroup[],
  digitalContacts: DigitalContact[],
): string | null {
  if (ref.kind === 'talkGroup') {
    return findTalkGroupById(ref.id, talkGroups)?.name ?? null;
  }
  if (ref.kind === 'digitalContact') {
    return findDigitalContactById(ref.id, digitalContacts)?.name ?? null;
  }
  return null;
}

export interface EntityRefExportLabelOptions {
  useAbbreviation?: boolean;
}

/** Export wire label for an entity ref — may use talk-group abbreviation. */
export function entityRefExportLabel(
  ref: EntityRef,
  talkGroups: TalkGroup[],
  digitalContacts: DigitalContact[],
  options: EntityRefExportLabelOptions = {},
): string | null {
  if (ref.kind === 'talkGroup') {
    const tg = findTalkGroupById(ref.id, talkGroups);
    if (!tg) return null;
    const abbrev = tg.abbreviation?.trim();
    if (options.useAbbreviation && abbrev) return abbrev;
    return tg.name;
  }
  if (ref.kind === 'digitalContact') {
    return findDigitalContactById(ref.id, digitalContacts)?.name ?? null;
  }
  return null;
}
