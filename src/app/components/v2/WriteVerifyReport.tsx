import type { ReactNode } from 'react';
import classes from './WriteVerifyReport.module.css';
import StatusDot, { type StatusDotTone } from './StatusDot.tsx';

export interface WriteVerifyReportSummaryItem {
  value: ReactNode;
  label: ReactNode;
  tone?: 'default' | 'warning' | 'destructive';
}

export interface WriteVerifyReportRow {
  id: string;
  tone: StatusDotTone;
  label: ReactNode;
  detail?: ReactNode;
}

export interface WriteVerifyReportProps {
  title?: ReactNode;
  /** Big-number stat row. */
  summary?: WriteVerifyReportSummaryItem[];
  rows: WriteVerifyReportRow[];
  caption?: ReactNode;
}

const SUMMARY_TONE_CLASS: Record<NonNullable<WriteVerifyReportSummaryItem['tone']>, string> = {
  default: classes.summaryValueDefault,
  warning: classes.summaryValueWarning,
  destructive: classes.summaryValueDestructive,
};

/**
 * Simple bordered write/verify results card — **stub only** this PR (static
 * fixture props, no interactivity). Full data wiring to real
 * `WriteVerifyResult` types lands in the builds ticket (#924). Visual shape
 * referenced from `builds/WriteVerifyReport.tsx` — not imported from it.
 */
export default function WriteVerifyReport({
  title = 'Write & verify report',
  summary,
  rows,
  caption,
}: WriteVerifyReportProps) {
  return (
    <div className={classes.root}>
      <div className={classes.title}>{title}</div>
      {summary && summary.length > 0 ? (
        <div className={classes.summaryRow}>
          {summary.map((item, index) => (
            <div key={index} className={classes.summaryItem}>
              <div className={SUMMARY_TONE_CLASS[item.tone ?? 'default']}>{item.value}</div>
              <div className={classes.summaryLabel}>{item.label}</div>
            </div>
          ))}
        </div>
      ) : null}
      <div className={classes.rows}>
        {rows.map((row) => (
          <div key={row.id} className={classes.row}>
            <StatusDot label={row.label} tone={row.tone} />
            {row.detail ? <span className={classes.detail}>{row.detail}</span> : null}
          </div>
        ))}
      </div>
      {caption ? <div className={classes.caption}>{caption}</div> : null}
    </div>
  );
}
