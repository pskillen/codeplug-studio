import { useState } from 'react';
import { IconChevronDown } from '@tabler/icons-react';
import type { CalibrationChart } from '@integrations/radio-io/debugView';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import Pill from '../v2/Pill.tsx';
import { numericDiffCount } from './chartText.ts';
import ConfidenceBadge from './ConfidenceBadge.tsx';
import DebugSection from './DebugSection.tsx';
import FrequencyCurveChart from './FrequencyCurveChart.tsx';
import NumericTable from './NumericTable.tsx';
import StepBarChart from './StepBarChart.tsx';
import tableClasses from './DebugTable.module.css';
import classes from './CalibrationChartCard.module.css';

export interface CalibrationChartCardProps {
  chart: CalibrationChart;
  /** The same chart (same id) from the overlay read. Ignored when its kind differs. */
  overlay?: CalibrationChart;
  readLabel?: string;
  overlayLabel?: string;
}

/** Chart kinds the card draws. Others (battery, trim) render nothing until the card learns them. */
export const CARD_CHART_KINDS: readonly CalibrationChart['kind'][] = [
  'frequency-curve',
  'step-bars',
];

export const DISCRETE_NOTE = 'Lines join neighbouring entries as a guide only.';

function AboutFold({ text }: { text: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        className={tableClasses.toggle}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span>About this chart</span>
        <IconChevronDown
          size={ICON_SIZE_NAV}
          stroke={ICON_STROKE}
          aria-hidden
          style={{ transform: open ? undefined : 'rotate(-90deg)' }}
        />
      </button>
      {open ? (
        <div>
          {text.map((t) => (
            <p key={t} className={classes.about}>
              {t}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * One calibration chart in its container: title row (address, confidence badges, and with an overlay a diff badge),
 * the one-line meaning, the chart, then the **About this chart** and **Numeric table** folds. Renders nothing for a
 * chart kind it cannot draw yet.
 */
export default function CalibrationChartCard({
  chart,
  overlay,
  readLabel,
  overlayLabel,
}: CalibrationChartCardProps) {
  if (!CARD_CHART_KINDS.includes(chart.kind)) return null;
  const sameKind = overlay && overlay.kind === chart.kind ? overlay : undefined;
  const diff = sameKind ? numericDiffCount(chart.table, sameKind.table) : undefined;
  const about = [
    chart.about,
    chart.kind === 'frequency-curve' && chart.discrete ? DISCRETE_NOTE : undefined,
  ].filter((t): t is string => Boolean(t));

  const meta = (
    <>
      {chart.address ? <code className={classes.address}>{chart.address}</code> : null}
      {chart.confidence ? (
        <>
          <ConfidenceBadge value={chart.confidence.layout} kind="layout" />
          <ConfidenceBadge value={chart.confidence.meaning} kind="meaning" />
        </>
      ) : null}
      {diff === undefined ? null : diff === 0 ? (
        <Pill tone="success">same in both</Pill>
      ) : (
        <Pill tone="warning">{diff === 1 ? '1 value differs' : `${diff} values differ`}</Pill>
      )}
    </>
  );

  return (
    <DebugSection id={chart.id} title={chart.title} description={chart.meaning} meta={meta}>
      <div className={classes.chart}>
        {chart.kind === 'frequency-curve' ? (
          <FrequencyCurveChart
            chart={chart}
            overlay={sameKind?.kind === 'frequency-curve' ? sameKind : undefined}
            readLabel={readLabel}
            overlayLabel={overlayLabel}
          />
        ) : chart.kind === 'step-bars' ? (
          <StepBarChart
            chart={chart}
            overlay={sameKind?.kind === 'step-bars' ? sameKind : undefined}
            readLabel={readLabel}
            overlayLabel={overlayLabel}
          />
        ) : null}
      </div>
      <div className={classes.folds}>
        {about.length ? <AboutFold text={about} /> : null}
        <NumericTable
          table={chart.table}
          overlay={sameKind?.table}
          readLabel={readLabel}
          overlayLabel={overlayLabel}
        />
      </div>
    </DebugSection>
  );
}
