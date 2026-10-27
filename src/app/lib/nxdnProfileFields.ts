import type { EntityRef, Library, NxdnRate } from '@core/models/library.ts';
import { rxGroupListModes } from '@core/domain/validation.ts';

/** UI wording for the NXDN channel fields, kept in one place so a relabel is a one-file change. */
export const NXDN_FIELD_LABELS = {
  rxRan: 'RX RAN',
  txRan: 'TX RAN',
  rate: 'Rate',
  unitId: 'Unit ID',
  call: 'Call',
  rxGroupList: 'RX group list',
} as const;

export const NXDN_FIELD_HINTS = {
  rate: 'NXDN48 is 6.25 kHz, NXDN96 is 12.5 kHz. Radio default leaves it to the radio.',
  call: 'The talk group or contact this channel calls.',
  rxGroupList: 'NXDN talk groups and contacts to listen to.',
} as const;

/** Value of the "Radio default" rate option (a Mantine Select cannot hold `null`). */
export const NXDN_RATE_DEFAULT_VALUE = '';

export const NXDN_RATE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: NXDN_RATE_DEFAULT_VALUE, label: 'Radio default' },
  { value: 'nxdn48', label: 'NXDN48 (6.25 kHz)' },
  { value: 'nxdn96', label: 'NXDN96 (12.5 kHz)' },
];

export function nxdnRateFromSelectValue(value: string | null): NxdnRate | null {
  return value === 'nxdn48' || value === 'nxdn96' ? value : null;
}

/** Call select options: NXDN talk groups (`tg:` prefix) then NXDN contacts (bare id), as the DMR panel. */
export function nxdnCallOptions(library: Library): Array<{ value: string; label: string }> {
  return [
    { value: '', label: 'None' },
    ...library.talkGroups
      .filter((t) => t.mode === 'nxdn')
      .map((t) => ({ value: `tg:${t.id}`, label: `${t.name} (group)` })),
    ...library.digitalContacts
      .filter((c) => c.mode === 'nxdn')
      .map((c) => ({ value: c.id, label: c.name })),
  ];
}

export function nxdnCallValue(ref: EntityRef | null | undefined): string {
  if (ref?.kind === 'digitalContact') return ref.id;
  if (ref?.kind === 'talkGroup') return `tg:${ref.id}`;
  return '';
}

export function nxdnCallFromSelectValue(value: string | null): EntityRef | null {
  if (!value) return null;
  return value.startsWith('tg:')
    ? { kind: 'talkGroup', id: value.slice(3) }
    : { kind: 'digitalContact', id: value };
}

/**
 * RX group list options for an NXDN channel: lists with no non-NXDN members,
 * plus the currently chosen list when it mixes modes (labelled as such).
 */
export function nxdnRxGroupListOptions(
  library: Library,
  currentListId: string | null | undefined,
): Array<{ value: string; label: string }> {
  const options = [{ value: '', label: 'None' }];
  for (const list of library.rxGroupLists) {
    const modes = rxGroupListModes(list, library);
    const nxdnOnly = [...modes].every((m) => m === 'nxdn');
    if (nxdnOnly) {
      options.push({ value: list.id, label: list.name });
    } else if (list.id === currentListId) {
      options.push({ value: list.id, label: `${list.name} (mixes modes)` });
    }
  }
  return options;
}
