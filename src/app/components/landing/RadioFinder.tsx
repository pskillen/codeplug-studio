import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import {
  SUPPORT_COLUMNS,
  SUPPORT_GROUPS,
  listSupportModeColumns,
  radioModelDisplayLabel,
  type SupportFirmwareRow,
  type SupportModelRow,
} from '@core/radio-targets/index.ts';
import { modeLabel } from '@app/lib/channelModes.ts';
import { Button } from '../v2/index.ts';
import { FirmwareKindPill, RadioClassPill } from '../builds/RadioModelPills.tsx';
import SupportCellMark from './SupportCellMark.tsx';
import { supportCellTitle } from './supportLabels.ts';
import classes from './landing.module.css';

export interface RadioFinderProps {
  rows: readonly SupportModelRow[];
  /** Start a project (the landing page opens its New project dialog). */
  onStartProject: () => void;
}

function FirmwareCard({
  row,
  best,
  onStartProject,
  showFlash,
  supportedElsewhere,
  modeColumns,
}: {
  row: SupportFirmwareRow;
  best: boolean;
  onStartProject: () => void;
  showFlash: boolean;
  supportedElsewhere: string | undefined;
  modeColumns: readonly ChannelMode[];
}) {
  const label = row.firmware.label;
  return (
    <article
      className={`${classes.fwCard} ${best ? classes.fwCardBest : ''}`}
      data-testid={`fw-card-${row.firmware.id}`}
    >
      <header className={classes.fwHead}>
        <strong>{label}</strong>
        <FirmwareKindPill kind={row.firmware.kind} />
        {best ? <span className={classes.bestTag}>Most features</span> : null}
      </header>
      {row.build ? (
        <p className={classes.fwBuildLine} title={row.build.note}>
          Checked against {row.build.label}
        </p>
      ) : null}
      {row.supported ? (
        <>
          {SUPPORT_GROUPS.filter((g) => g.id !== 'firmware').map((group) => (
            <section key={group.id}>
              <h4 className={classes.groupLabel}>{group.label}</h4>
              <ul className={classes.featureList}>
                {SUPPORT_COLUMNS.filter((c) => c.group === group.id).map((col) => (
                  <li key={col.id} className={classes[`feature_${row.cells[col.id]}`]}>
                    <SupportCellMark
                      state={row.cells[col.id]}
                      note={row.notes[col.id]}
                      title={supportCellTitle(col.label, row.cells[col.id], {
                        note: row.notes[col.id],
                      })}
                    />
                    <span title={col.hint}>{col.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <section>
            <h4 className={classes.groupLabel}>Channel modes</h4>
            <ul className={classes.featureList}>
              {modeColumns.map((mode) => {
                const cell = row.modes[mode]!;
                return (
                  <li key={mode} className={classes[`feature_${cell.state}`]}>
                    <SupportCellMark
                      state={cell.state}
                      evidence={cell.evidence}
                      note={cell.note}
                      title={supportCellTitle(modeLabel(mode), cell.state, cell)}
                    />
                    <span>{modeLabel(mode)}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      ) : (
        <p className={classes.notSupported}>
          <strong>Not supported.</strong>{' '}
          {supportedElsewhere
            ? `Codeplug Studio can\u2019t build for ${label.toLowerCase()} firmware on this radio yet. Use ${supportedElsewhere} instead.`
            : 'Codeplug Studio can\u2019t build for this firmware yet.'}
        </p>
      )}
      {row.supported ? (
        <div className={classes.cardActions}>
          <Button size="sm" variant={best ? 'primary' : 'secondary'} onClick={onStartProject}>
            Start a project
          </Button>
          {showFlash ? (
            <Link to="/firmware" className={classes.cardLink}>
              Flash {label}
            </Link>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/** "What radio have you got?": chips for every catalog model, then one card per firmware variant. */
export default function RadioFinder({ rows, onStartProject }: RadioFinderProps) {
  const [selectedId, setSelectedId] = useState<string | undefined>(rows[0]?.model.id);
  const modeColumns = useMemo(() => listSupportModeColumns(), []);
  const selected = useMemo(
    () => rows.find((r) => r.model.id === selectedId) ?? rows[0],
    [rows, selectedId],
  );
  if (!selected) return null;
  const { model } = selected;
  const supportedCount = selected.firmware.filter((f) => f.supported).length;
  const bestLabel = selected.firmware.find((f) => f.firmware.id === selected.bestFirmwareId)
    ?.firmware.label;

  return (
    <section className={classes.finder} aria-labelledby="landing-finder-title">
      <h2 id="landing-finder-title" className={classes.sectionTitle}>
        What radio have you got?
      </h2>
      <p className={classes.sectionLead}>
        Pick it to see what Codeplug Studio can do with it on each firmware.
      </p>
      <div className={classes.chips} role="group" aria-label="Radio">
        {rows.map((r) => (
          <button
            key={r.model.id}
            type="button"
            className={`${classes.chip} ${r.model.id === model.id ? classes.chipOn : ''}`}
            aria-pressed={r.model.id === model.id}
            onClick={() => setSelectedId(r.model.id)}
          >
            {radioModelDisplayLabel(r.model)}
          </button>
        ))}
      </div>
      <div className={classes.radioHead}>
        <h3>{radioModelDisplayLabel(model)}</h3>
        <RadioClassPill radioClass={model.radioClass} />
        <span className={classes.muted}>
          {model.formFactor === 'mobile' ? 'Mobile' : 'Handheld'} · {supportedCount} of{' '}
          {selected.firmware.length} firmware supported
        </span>
      </div>
      <div className={classes.cards}>
        {selected.firmware.map((row) => (
          <FirmwareCard
            key={row.firmware.id}
            row={row}
            best={row.firmware.id === selected.bestFirmwareId && supportedCount > 1}
            onStartProject={onStartProject}
            showFlash={row.cells.flash === 'supported'}
            supportedElsewhere={bestLabel}
            modeColumns={modeColumns}
          />
        ))}
      </div>
    </section>
  );
}
