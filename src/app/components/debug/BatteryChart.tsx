import { useComputedColorScheme } from '@mantine/core';
import {
  formatDecimal,
  formatHexDec,
  NOT_CAPTURED_TEXT,
  type BatteryLadder,
} from '@integrations/radio-io/debugView';
import { lineChartSlotColor } from '../LineChart/lineChartScale.ts';
import classes from './BatteryChart.module.css';

export interface BatteryChartProps {
  chart: BatteryLadder;
  /** The same ladder from a second read, drawn as a second column; steps pair by position. */
  overlay?: BatteryLadder;
  readLabel?: string;
  overlayLabel?: string;
}

/** Bar length is raw / this: at least a full 8-bit ADC code. */
const MIN_FULL_SCALE = 255;

function Column({
  ladder,
  title,
  slot,
  fullScale,
}: {
  ladder: BatteryLadder;
  title?: string;
  slot: number;
  fullScale: number;
}) {
  const scheme = useComputedColorScheme('light');
  const color = lineChartSlotColor(slot, scheme);
  // Highest step on top.
  const steps = [...ladder.steps].reverse();
  return (
    <div className={classes.column}>
      {title ? <div className={classes.title}>{title}</div> : null}
      {ladder.blank ? <p className={classes.blank}>{ladder.blank}</p> : null}
      {ladder.blank
        ? null
        : steps.map((s) => (
            <div key={s.id} className={classes.row}>
              <span className={classes.label}>{s.label}</span>
              {s.raw === undefined ? (
                <span className={classes.missing}>{NOT_CAPTURED_TEXT}</span>
              ) : (
                <>
                  <span className={classes.track}>
                    <span
                      className={classes.bar}
                      data-testid="battery-bar"
                      style={{
                        width: `${Math.max(1, (s.raw / fullScale) * 100)}%`,
                        background: color,
                      }}
                    />
                  </span>
                  <span className={classes.value}>
                    {formatHexDec(s.raw)}
                    {s.volts === undefined ? '' : `, ${formatDecimal(s.volts, 'V')}`}
                  </span>
                </>
              )}
            </div>
          ))}
    </div>
  );
}

/**
 * Battery thresholds as a ladder, highest step on top: a bar per step with its raw ADC code (`0x1A (26)`) and, when
 * the radio home knows the scale, the volts beside it. A second column carries the overlay read. A ladder with `blank`
 * shows that text instead of bars; a step with no raw is "Not captured", never zero.
 */
export default function BatteryChart({
  chart,
  overlay,
  readLabel,
  overlayLabel,
}: BatteryChartProps) {
  const raws = [...chart.steps, ...(overlay?.steps ?? [])]
    .map((s) => s.raw)
    .filter((r): r is number => r !== undefined);
  const fullScale = Math.max(MIN_FULL_SCALE, ...raws);
  return (
    <div className={classes.root} role="group" aria-label={chart.title}>
      <Column
        ladder={chart}
        title={overlay ? (readLabel ?? 'Read') : readLabel}
        slot={0}
        fullScale={fullScale}
      />
      {overlay ? (
        <Column ladder={overlay} title={overlayLabel ?? 'Overlay'} slot={1} fullScale={fullScale} />
      ) : null}
    </div>
  );
}
