/**
 * Operator-facing Web Serial Write coverage for AT-D890UV Export UI.
 * Single source for the "What Write updates" table — no hex addresses.
 */

export type AtD890WriteCoverageStatus =
  'written' | 'planned' | 'leftAlone' | 'preserved' | 'separateWrite';

export interface AtD890WriteCoverageRow {
  label: string;
  status: AtD890WriteCoverageStatus;
  /** Replaces the status label when the row has something more precise to say. */
  note?: string;
}

/** The Radio settings row's label (the count of session changes is reported on it). */
export const AT_D890_RADIO_SETTINGS_COVERAGE_LABEL = 'Radio settings';

export const AT_D890_WRITE_COVERAGE_STATUS_LABEL: Record<AtD890WriteCoverageStatus, string> = {
  written: 'Updated from your library',
  planned: 'Not supported yet',
  leftAlone: 'Left alone',
  preserved: 'Carried through erase unchanged',
  /** Satellite keps (#859) — its own PROGRAM session, not part of this codeplug Write. */
  separateWrite: 'Updated separately via “Write Keps”',
};

const RADIO_ID_COVERAGE_LABELS = new Set(['Operator radio IDs', 'Master radio ID']);

/** Rows for Export Web Serial — aligned with v1 Write allow-list and deferred banks. */
export const AT_D890_WRITE_COVERAGE_ROWS: readonly AtD890WriteCoverageRow[] = [
  { label: 'Channels', status: 'written' },
  { label: 'Zones', status: 'written' },
  { label: 'Scan lists', status: 'written' },
  { label: 'Talk groups', status: 'written' },
  { label: 'RX group lists', status: 'written' },
  { label: 'Operator radio IDs', status: 'written' },
  { label: 'Master radio ID', status: 'written' },
  { label: 'Digital APRS settings', status: 'written' },
  { label: 'AM airband', status: 'written' },
  { label: 'AM airband zones', status: 'written' },
  { label: 'Satellite keps', status: 'separateWrite' },
  { label: 'Broadcast FM', status: 'planned' },
  { label: 'Digital contacts', status: 'planned' },
  { label: 'Boot images', status: 'planned' },
  { label: 'Analog address book', status: 'planned' },
  { label: 'Local info and band settings', status: 'leftAlone' },
  { label: AT_D890_RADIO_SETTINGS_COVERAGE_LABEL, status: 'preserved' },
  { label: 'Channel positions (MM9PDY firmware)', status: 'leftAlone' },
  { label: 'NXDN channel settings', status: 'preserved' },
  { label: 'NXDN talk groups and contacts', status: 'leftAlone' },
  { label: 'NXDN RX group lists', status: 'leftAlone' },
] as const;

/**
 * MM9PDY target rows: the same table, except channel positions are written from your
 * library (channels with a position and *Use location* on) and NXDN channel settings are
 * written when the radio reports NXDN enabled, as are the NXDN talk groups, contacts and RX
 * group lists (when the build has any).
 */
export const AT_D890_MM9PDY_WRITE_COVERAGE_ROWS: readonly AtD890WriteCoverageRow[] =
  AT_D890_WRITE_COVERAGE_ROWS.map((row) => {
    if (row.label === 'Channel positions (MM9PDY firmware)') return { ...row, status: 'written' };
    if (row.label === 'NXDN channel settings') {
      return {
        ...row,
        status: 'written',
        note: 'Updated when the radio reports NXDN enabled; Reset Digital Protocol is then set to Off',
      };
    }
    if (row.label === 'NXDN talk groups and contacts' || row.label === 'NXDN RX group lists') {
      return {
        ...row,
        status: 'written',
        note: 'Updated when the radio reports NXDN enabled and your library has NXDN entries',
      };
    }
    return row;
  });

/**
 * The rows for a target. `settingsChangeCount` is how many Radio settings fields the user has set
 * this session: the Radio settings row then reads "Preserved, except N fields you set".
 */
export function atD890WriteCoverageRows(
  mm9pdy: boolean,
  settingsChangeCount = 0,
  hasDefaultDmrId = false,
): readonly AtD890WriteCoverageRow[] {
  const base = mm9pdy ? AT_D890_MM9PDY_WRITE_COVERAGE_ROWS : AT_D890_WRITE_COVERAGE_ROWS;
  // Radio IDs and the master ID come from the default DMR Digital ID; without one they stay as read.
  const rows = base.map((row): AtD890WriteCoverageRow => {
    if (!RADIO_ID_COVERAGE_LABELS.has(row.label)) return row;
    return hasDefaultDmrId
      ? { ...row, status: 'written', note: 'From your Digital IDs' }
      : { ...row, status: 'leftAlone', note: 'No default DMR ID' };
  });
  if (settingsChangeCount <= 0) return rows;
  const note = `Preserved, except ${settingsChangeCount} ${
    settingsChangeCount === 1 ? 'field' : 'fields'
  } you set`;
  return rows.map((row) =>
    row.label === AT_D890_RADIO_SETTINGS_COVERAGE_LABEL ? { ...row, note } : row,
  );
}
