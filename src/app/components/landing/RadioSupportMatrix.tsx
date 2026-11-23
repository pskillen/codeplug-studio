import { useMemo, useState } from 'react';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import {
  SUPPORT_COLUMNS,
  SUPPORT_GROUPS,
  filterSupportMatrix,
  listSupportModeColumns,
  radioModelDisplayLabel,
  type SupportColumn,
  type SupportModelRow,
  type SupportState,
} from '@core/radio-targets/index.ts';
import { modeLabel } from '@app/lib/channelModes.ts';
import { SegmentedControl } from '../v2/index.ts';
import { FirmwareKindPill, RadioClassPill } from '../builds/RadioModelPills.tsx';
import SupportCellMark from './SupportCellMark.tsx';
import SupportMark from './SupportMark.tsx';
import {
  SUPPORT_EVIDENCE_LABEL,
  SUPPORT_EVIDENCE_SHORT,
  SUPPORT_STATE_LABEL,
  supportCellTitle,
} from './supportLabels.ts';
import classes from './landing.module.css';

type ClassFilter = 'all' | 'dmr' | 'fm';

const LEGEND_STATES: SupportState[] = ['supported', 'partial', 'unsupported', 'na'];

const LEGEND_HINT: Record<SupportState, string> = {
  supported: 'Works today',
  partial: 'Works in a reduced form',
  unsupported: 'Not available for this radio and firmware',
  na: 'The radio hardware can\u2019t do it',
};

type MatrixCol = { kind: 'feature'; col: SupportColumn } | { kind: 'mode'; mode: ChannelMode };

function matrixColumns(modeColumns: readonly ChannelMode[]): MatrixCol[] {
  const cols: MatrixCol[] = [];
  for (const c of SUPPORT_COLUMNS) {
    if (c.group === 'program') cols.push({ kind: 'feature', col: c });
  }
  for (const mode of modeColumns) cols.push({ kind: 'mode', mode });
  for (const c of SUPPORT_COLUMNS) {
    if (c.group !== 'program') cols.push({ kind: 'feature', col: c });
  }
  return cols;
}

const PROGRAM_COL_COUNT = SUPPORT_COLUMNS.filter((c) => c.group === 'program').length;

/** "Compare all radios": a row per model, a sub-row per firmware, grouped feature columns, legend underneath. */
export default function RadioSupportMatrix({ rows }: { rows: readonly SupportModelRow[] }) {
  const [filter, setFilter] = useState<ClassFilter>('all');
  const visible = filterSupportMatrix(rows, filter);
  const modeColumns = useMemo(() => listSupportModeColumns(), []);
  const columns = useMemo(() => matrixColumns(modeColumns), [modeColumns]);
  const totalCols = SUPPORT_COLUMNS.length + modeColumns.length + 1;

  return (
    <section className={classes.matrixSection} aria-labelledby="landing-matrix-title">
      <div className={classes.matrixHead}>
        <h2 id="landing-matrix-title" className={classes.sectionTitle}>
          Compare all radios
        </h2>
        <SegmentedControl<ClassFilter>
          aria-label="Radio class"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'dmr', label: 'DMR' },
            { value: 'fm', label: 'FM' },
          ]}
        />
      </div>
      <div className={classes.matrixScroll} tabIndex={0} role="region" aria-label="Support matrix">
        <table className={classes.matrix}>
          <thead>
            <tr>
              <th rowSpan={2} scope="col" className={classes.radioCol}>
                Radio
              </th>
              <th scope="colgroup" colSpan={PROGRAM_COL_COUNT} className={classes.groupHead}>
                {SUPPORT_GROUPS.find((g) => g.id === 'program')!.label}
              </th>
              {modeColumns.length > 0 ? (
                <th scope="colgroup" colSpan={modeColumns.length} className={classes.groupHead}>
                  Channel modes
                </th>
              ) : null}
              {SUPPORT_GROUPS.filter((g) => g.id !== 'program').map((g) => (
                <th
                  key={g.id}
                  scope="colgroup"
                  colSpan={SUPPORT_COLUMNS.filter((c) => c.group === g.id).length}
                  className={classes.groupHead}
                >
                  {g.label}
                </th>
              ))}
            </tr>
            <tr>
              {columns.map((entry) =>
                entry.kind === 'feature' ? (
                  <th
                    key={entry.col.id}
                    scope="col"
                    title={entry.col.hint}
                    className={classes.colHead}
                  >
                    {entry.col.label}
                  </th>
                ) : (
                  <th
                    key={entry.mode}
                    scope="col"
                    title={`Channel mode ${modeLabel(entry.mode)}`}
                    className={classes.colHead}
                  >
                    {modeLabel(entry.mode)}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => (
              <ModelRows key={m.model.id} row={m} columns={columns} totalCols={totalCols} />
            ))}
          </tbody>
        </table>
      </div>
      <ul className={classes.legend} aria-label="Legend">
        {LEGEND_STATES.map((s) => (
          <li key={s}>
            <SupportMark state={s} />
            <span>
              <strong>{SUPPORT_STATE_LABEL[s]}</strong> — {LEGEND_HINT[s]}
            </span>
          </li>
        ))}
      </ul>
      <ul className={classes.legend} aria-label="Evidence">
        {(Object.keys(SUPPORT_EVIDENCE_SHORT) as (keyof typeof SUPPORT_EVIDENCE_SHORT)[]).map(
          (key) => (
            <li key={key}>
              <span
                className={`${classes.evidenceTag} ${classes[`evidence_${key.replace('-', '_')}`]}`}
              >
                {SUPPORT_EVIDENCE_SHORT[key]}
              </span>
              <span>{SUPPORT_EVIDENCE_LABEL[key]}</span>
            </li>
          ),
        )}
        <li>
          <span className={classes.dagger} aria-hidden="true">
            †
          </span>
          <span>Depends on the radio's firmware build; Studio checks when it connects</span>
        </li>
      </ul>
    </section>
  );
}

function ModelRows({
  row,
  columns,
  totalCols,
}: {
  row: SupportModelRow;
  columns: MatrixCol[];
  totalCols: number;
}) {
  return (
    <>
      <tr className={classes.modelRow}>
        <th scope="rowgroup" colSpan={totalCols} className={classes.modelCell}>
          <span className={classes.modelCellInner}>
            {radioModelDisplayLabel(row.model)}
            <RadioClassPill radioClass={row.model.radioClass} />
          </span>
        </th>
      </tr>
      {row.firmware.map((fw) => (
        <tr key={fw.firmware.id} data-testid={`matrix-${row.model.id}-${fw.firmware.id}`}>
          <th scope="row" className={`${classes.radioCol} ${classes.fwCell}`}>
            {fw.firmware.label} <FirmwareKindPill kind={fw.firmware.kind} />
            {fw.build ? (
              <span className={classes.fwBuild} title={fw.build.note}>
                {fw.build.label}
              </span>
            ) : null}
          </th>
          {columns.map((entry) =>
            entry.kind === 'feature' ? (
              <td key={entry.col.id} className={classes.markCell}>
                <SupportCellMark
                  state={fw.cells[entry.col.id]}
                  note={fw.notes[entry.col.id]}
                  title={supportCellTitle(entry.col.label, fw.cells[entry.col.id], {
                    note: fw.notes[entry.col.id],
                  })}
                />
              </td>
            ) : (
              <td key={entry.mode} className={classes.markCell}>
                {(() => {
                  const cell = fw.modes[entry.mode]!;
                  return (
                    <SupportCellMark
                      state={cell.state}
                      evidence={cell.evidence}
                      note={cell.note}
                      title={supportCellTitle(modeLabel(entry.mode), cell.state, cell)}
                      data-testid={`mode-${row.model.id}-${fw.firmware.id}-${entry.mode}`}
                    />
                  );
                })()}
              </td>
            ),
          )}
        </tr>
      ))}
    </>
  );
}
