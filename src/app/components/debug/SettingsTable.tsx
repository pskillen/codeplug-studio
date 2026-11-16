import { useMemo, useState } from 'react';
import type { SettingRow, SettingsView } from '@integrations/radio-io/debugView';
import SensitiveRevealButton from './SensitiveRevealButton.tsx';
import SearchInput from '../v2/SearchInput.tsx';
import ToggleSwitch from '../v2/ToggleSwitch.tsx';
import ConfidenceBadge from './ConfidenceBadge.tsx';
import { confidenceLabel } from './confidence.ts';
import DebugSection from './DebugSection.tsx';
import { MASKED_TEXT } from './HexDecValue.tsx';
import classes from './SettingsTable.module.css';

export interface SettingsTableProps {
  view: SettingsView;
  /** Whether sensitive rows are shown; hidden unless the viewer reveals them. */
  revealed: boolean;
  onToggleReveal: () => void;
}

const NOT_CAPTURED = 'Not captured';
const HIDDEN = 'Hidden (password)';
const DASH = '—';

const hexByte = (b: number) => b.toString(16).toUpperCase().padStart(2, '0');
const matches = (query: string, haystack: readonly string[]) => {
  const q = query.trim().toLocaleLowerCase();
  return !q || haystack.some((h) => h.toLocaleLowerCase().includes(q));
};

/** Column widths in percent: one set for every group on the tab. */
function columnWidths(showRaw: boolean, showDefault: boolean): readonly number[] {
  // Setting, Value, [Address, Raw], [Default], Confidence
  if (showRaw) return showDefault ? [24, 16, 14, 14, 10, 22] : [28, 18, 14, 16, 24];
  return showDefault ? [36, 24, 14, 26] : [40, 30, 30];
}

function valueText(row: SettingRow, revealed: boolean): string {
  if (row.sensitive && !revealed) return HIDDEN;
  if (row.value === undefined) return NOT_CAPTURED;
  if (row.value === '') return '(empty)';
  if (row.rawValue !== undefined && !/^-?\d+(\.\d+)?$/.test(row.value))
    return `${row.value} (${row.rawValue})`;
  return row.value;
}

function rawText(row: SettingRow, revealed: boolean): string {
  if (!row.raw) return DASH;
  if (row.sensitive && !revealed) return row.raw.map(() => MASKED_TEXT).join(' ');
  return row.raw.map(hexByte).join(' ');
}

function rowMatches(query: string, row: SettingRow, groupLabel: string, revealed: boolean) {
  return matches(query, [
    row.label,
    row.id,
    row.help ?? '',
    groupLabel,
    valueText(row, revealed),
    rawText(row, revealed),
    confidenceLabel(row.confidence),
    row.address ?? '',
    row.evidence ?? '',
  ]);
}

function RowsTable({
  label,
  rows,
  showRaw,
  showDefault,
  revealed,
}: {
  label: string;
  rows: readonly SettingRow[];
  showRaw: boolean;
  showDefault: boolean;
  revealed: boolean;
}) {
  const widths = columnWidths(showRaw, showDefault);
  return (
    <div className={classes.scroll}>
      <table className={classes.table} aria-label={label} style={{ minWidth: showRaw ? 860 : 600 }}>
        <colgroup>
          {widths.map((w, i) => (
            <col key={i} style={{ width: `${w}%` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col">Setting</th>
            <th scope="col">Value</th>
            {showRaw && <th scope="col">Address</th>}
            {showRaw && <th scope="col">Raw</th>}
            {showDefault && <th scope="col">Default</th>}
            <th scope="col">Confidence</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                {row.label}
                {row.help && <span className={classes.help}>{row.help}</span>}
              </td>
              <td>{valueText(row, revealed)}</td>
              {showRaw && <td className={classes.mono}>{row.address ?? DASH}</td>}
              {showRaw && <td className={classes.mono}>{rawText(row, revealed)}</td>}
              {showDefault && <td>{row.firmwareDefault ?? DASH}</td>}
              <td>
                <ConfidenceBadge value={row.confidence} />
                {row.evidence && <span className={classes.evidence}>{row.evidence}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The whole Settings tab body for one read: summary, intro, search and toggles, one striped table
 * per group with the same columns and widths everywhere, and the trailing sections folded.
 * Radio-neutral: every sentence arrives in the `SettingsView`.
 */
export default function SettingsTable({ view, revealed, onToggleReveal }: SettingsTableProps) {
  const [query, setQuery] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const allRows = useMemo(
    () => [...view.groups.flatMap((g) => g.rows), ...(view.trailing ?? []).flatMap((t) => t.rows)],
    [view],
  );
  if (view.status.kind !== 'ok') {
    return (
      <div className={classes.status} role="status">
        <h3 className={classes.statusTitle}>
          {view.status.kind === 'ambiguous' ? 'Several pages, not decoded' : NOT_CAPTURED}
        </h3>
        <p className={classes.intro}>
          {view.status.reason} This does not mean the radio has default settings.
        </p>
      </div>
    );
  }
  const searching = query.trim() !== '';
  const showDefault = allRows.some((r) => r.firmwareDefault !== undefined);
  const hasSensitive = allRows.some((r) => r.sensitive);
  const shownGroups = view.groups.flatMap((g) => {
    const rows = g.rows.filter((r) => !searching || rowMatches(query, r, g.label, revealed));
    return rows.length === 0 && searching ? [] : [{ g, rows }];
  });
  const shownTrailing = (view.trailing ?? []).flatMap((t) => {
    const rows = t.rows.filter((r) => !searching || rowMatches(query, r, t.title, revealed));
    return rows.length === 0 && searching ? [] : [{ t, rows }];
  });
  return (
    <div className={classes.root}>
      <p className={classes.summary}>{view.summary}</p>
      <p className={classes.intro}>{view.intro}</p>
      <div className={classes.toolbar}>
        <SearchInput
          className={classes.search}
          aria-label="Search settings"
          placeholder="Search settings"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
        <ToggleSwitch label="Show raw bytes + address" checked={showRaw} onChange={setShowRaw} />
        {hasSensitive && <SensitiveRevealButton revealed={revealed} onToggle={onToggleReveal} />}
      </div>
      <div className={classes.sections}>
        {shownGroups.map(({ g, rows }) => (
          <DebugSection key={g.id} id={g.id} title={g.label} description={g.description}>
            {rows.length === 0 ? (
              <p className={classes.empty}>{g.emptyText ?? 'No settings in this group.'}</p>
            ) : (
              <RowsTable
                label={`${g.label} settings`}
                rows={rows}
                showRaw={showRaw}
                showDefault={showDefault}
                revealed={revealed}
              />
            )}
          </DebugSection>
        ))}
        {shownTrailing.map(({ t, rows }) => (
          <DebugSection
            // Remount when searching so a match is never hidden inside a folded section.
            key={`${t.id}-${searching}`}
            id={t.id}
            title={t.title}
            description={t.description}
            meta={<span>{rows.length}</span>}
            collapsible
            defaultCollapsed={!searching}
          >
            {rows.length === 0 ? (
              <p className={classes.empty}>{t.emptyText ?? 'Nothing here.'}</p>
            ) : (
              <RowsTable
                label={t.title}
                rows={rows}
                showRaw={showRaw}
                showDefault={showDefault}
                revealed={revealed}
              />
            )}
          </DebugSection>
        ))}
        {searching && shownGroups.length === 0 && shownTrailing.length === 0 && (
          <p className={classes.empty}>No settings match “{query.trim()}”.</p>
        )}
      </div>
    </div>
  );
}
