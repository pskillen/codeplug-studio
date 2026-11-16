import type { ReactNode } from 'react';
import classes from './CalibrationChartCard.module.css';

export interface CalibrationChartGridProps {
  /** `CalibrationChartCard`s, in chart order. */
  children: ReactNode;
}

/** The chart cards of a Calibration tab: two columns from the `md` breakpoint, one below. */
export default function CalibrationChartGrid({ children }: CalibrationChartGridProps) {
  return <div className={classes.grid}>{children}</div>;
}
