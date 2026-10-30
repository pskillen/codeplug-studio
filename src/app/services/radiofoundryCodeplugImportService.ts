import { isBinaryCpsImportAdapter } from '@core/import-export/importAdapter.ts';
import { getImportAdapter } from '@core/import-export/registry.ts';
import type { BinaryCpsImportResult } from '@core/import-export/types.ts';
import type { ProjectPersistence, PutResult } from '@integrations/persistence/index.ts';
import { persistence } from '../state/persistence.ts';

export interface RadioFoundryCodeplugImportSuccess {
  ok: true;
  channelCount: number;
  zoneCount: number;
}

export interface RadioFoundryCodeplugImportFailure {
  ok: false;
  message: string;
}

export type RadioFoundryCodeplugImportResult =
  RadioFoundryCodeplugImportSuccess | RadioFoundryCodeplugImportFailure;

const SAVE_FAILED = 'Could not save the imported codeplug.';

/**
 * Parse a RadioFoundry `codeplug.bin` and add the library rows to the active project.
 * Parser failures write nothing.
 */
export async function importRadioFoundryCodeplug(
  projectId: string,
  bytes: Uint8Array,
  store: ProjectPersistence = persistence,
): Promise<RadioFoundryCodeplugImportResult> {
  const adapter = getImportAdapter('radiofoundry');
  if (!isBinaryCpsImportAdapter(adapter)) {
    return { ok: false, message: 'RadioFoundry import is not available.' };
  }

  let parsed: BinaryCpsImportResult;
  try {
    parsed = adapter.parse(bytes, projectId);
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    };
  }

  const failed =
    (await putRows(parsed.ownDigitalIds, (row) => store.putOwnDigitalId(row, null))) ??
    (await putRows(parsed.talkGroups, (row) => store.putTalkGroup(row, null))) ??
    (await putRows(parsed.digitalContacts, (row) => store.putDigitalContact(row, null))) ??
    (await putRows(parsed.rxGroupLists, (row) => store.putRxGroupList(row, null))) ??
    (await putRows(parsed.channels, (row) => store.putChannel(row, null))) ??
    (await putRows(parsed.zones, (row) => store.putZone(row, null)));
  if (failed) return { ok: false, message: failed };

  return {
    ok: true,
    channelCount: parsed.channels.length,
    zoneCount: parsed.zones.length,
  };
}

async function putRows<T>(
  rows: readonly T[],
  put: (row: T) => Promise<PutResult>,
): Promise<string | null> {
  for (const row of rows) {
    const result = await put(row);
    if (!result.ok) return SAVE_FAILED;
  }
  return null;
}
