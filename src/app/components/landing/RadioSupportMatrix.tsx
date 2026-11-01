import { useState } from 'react';
import {
  SUPPORT_COLUMNS,
  SUPPORT_GROUPS,
  filterSupportMatrix,
  radioModelDisplayLabel,
  type SupportModelRow,
  type SupportState,
} from '@core/radio-targets/index.ts';
import { SegmentedControl } from '../v2/index.ts';
import { FirmwareKindPill, RadioClassPill } from '../builds/RadioModelPills.tsx';
import SupportMark from './SupportMark.tsx';
import { SUPPORT_STATE_LABEL } from './supportLabels.ts';
import classes from './landing.module.css';

type ClassFilter = 'all' | 'dmr' | 'fm';

const LEGEND_STATES: SupportState[] = ['supported', 'partial', 'unsupported', 'na'];

const LEGEND_HINT: Record<SupportState, string> = {
  supported: 'Works today',
  partial: 'Works in a reduced form',
  unsupported: 'Not available for this radio and firmware',
  na: 'The radio hardware can’t do it',
};

/** "Compare all radios": a row per model, a sub-row per firmware, grouped feature columns, legend underneath. */
export default function RadioSupportMatrix({ rows }: { rows: readonly SupportModelRow[] }) {
  const [filter, setFilter] = useState<ClassFilter>('all');
  const visible = filterSupportMatrix(rows, filter);

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
              {SUPPORT_GROUPS.map((g) => (
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
              {SUPPORT_COLUMNS.map((c) => (
                <th key={c.id} scope="col" title={c.hint} className={classes.colHead}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((m) => (
              <ModelRows key={m.model.id} row={m} />
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
    </section>
  );
}

function ModelRows({ row }: { row: SupportModelRow }) {
  return (
    <>
      <tr className={classes.modelRow}>
        <th scope="rowgroup" colSpan={SUPPORT_COLUMNS.length + 1} className={classes.modelCell}>
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
          </th>
          {SUPPORT_COLUMNS.map((c) => (
            <td key={c.id} className={classes.markCell}>
              <SupportMark state={fw.cells[c.id]} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
