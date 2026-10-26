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
] as const;

/**
 * MM9PDY target rows: the same table, except channel positions are written from your
 * library (channels with a position and *Use location* on).
 */
export const AT_D890_MM9PDY_WRITE_COVERAGE_ROWS: readonly AtD890WriteCoverageRow[] =
  AT_D890_WRITE_COVERAGE_ROWS.map((row) =>
    row.label === 'Channel positions (MM9PDY firmware)' ? { ...row, status: 'written' } : row,
  );

/**
 * The rows for a target. `settingsChangeCount` is how many Radio settings fields the user has set
 * this session: the Radio settings row then reads "Preserved, except N fields you set".
 */
export function atD890WriteCoverageRows(
  mm9pdy: boolean,
  settingsChangeCount = 0,
): readonly AtD890WriteCoverageRow[] {
  const rows = mm9pdy ? AT_D890_MM9PDY_WRITE_COVERAGE_ROWS : AT_D890_WRITE_COVERAGE_ROWS;
  if (settingsChangeCount <= 0) return rows;
  const note = `Preserved, except ${settingsChangeCount} ${
    settingsChangeCount === 1 ? 'field' : 'fields'
  } you set`;
  return rows.map((row) =>
    row.label === AT_D890_RADIO_SETTINGS_COVERAGE_LABEL ? { ...row, note } : row,
  );
}
