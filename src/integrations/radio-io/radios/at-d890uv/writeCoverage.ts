/**
 * Operator-facing Web Serial Write coverage for AT-D890UV Export UI.
 * Single source for the "What Write updates" table — no hex addresses.
 */

export type AtD890WriteCoverageStatus =
  | 'written'
  | 'planned'
  | 'leftAlone'
  | 'preserved'
  | 'separateWrite';

export interface AtD890WriteCoverageRow {
  label: string;
  status: AtD890WriteCoverageStatus;
}

export const AT_D890_WRITE_COVERAGE_STATUS_LABEL: Record<AtD890WriteCoverageStatus, string> = {
  written: 'Updated from your library',
  planned: 'Not supported yet',
  leftAlone: 'Left alone',
  preserved: 'Carried through erase unchanged',
  /** Satellite keps (#859) — its own PROGRAM session, not part of this codeplug Write. */
  separateWrite: "Updated separately via “Write Keps”",
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
  { label: 'Optional settings (password, UI language)', status: 'preserved' },
] as const;
