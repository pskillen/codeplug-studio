import type { Library, OwnDigitalIdProtocol } from '@core/models/library.ts';
import { defaultOwnDigitalId, ownDigitalIdOptionLabel } from '@core/domain/ownDigitalIds.ts';

/** Value of the "Default" option (a Mantine Select cannot hold `null`). */
export const OWN_ID_DEFAULT_VALUE = '';

export const OWN_ID_PAGE_PATH = '/library/digital-ids';

export const OWN_ID_FIELD_HINTS: Record<OwnDigitalIdProtocol, string> = {
  dmr: 'The ID this channel sends. Default uses your default DMR ID.',
  nxdn: 'The ID this channel sends. Default uses your default NXDN ID. Radios with one NXDN ID always send the default.',
};

/**
 * Options for a channel's ID select: "Default (Name (number))" first, then that protocol's IDs.
 * A choice that is gone, or belongs to the other protocol, stays selectable as "(missing)" so the
 * profile never shows a blank it cannot explain.
 */
export function ownDigitalIdSelectData(
  library: Pick<Library, 'ownDigitalIds'>,
  protocol: OwnDigitalIdProtocol,
  current: string | null | undefined,
): { value: string; label: string }[] {
  const rows = library.ownDigitalIds.filter((row) => row.protocol === protocol);
  const fallback = defaultOwnDigitalId(library.ownDigitalIds, protocol);
  const data = [
    {
      value: OWN_ID_DEFAULT_VALUE,
      label: fallback ? `Default (${ownDigitalIdOptionLabel(fallback)})` : 'Default (none set)',
    },
    ...rows.map((row) => ({ value: row.id, label: ownDigitalIdOptionLabel(row) })),
  ];
  if (current && !rows.some((row) => row.id === current)) {
    data.push({ value: current, label: '(missing)' });
  }
  return data;
}

export function ownDigitalIdFromSelectValue(value: string | null): string | null {
  return value ? value : null;
}
