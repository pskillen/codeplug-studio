import type { SupportEvidence, SupportState } from '@core/radio-targets/index.ts';
import SupportMark from './SupportMark.tsx';
import { SUPPORT_EVIDENCE_SHORT } from './supportLabels.ts';
import classes from './landing.module.css';

export interface SupportCellMarkProps {
  state: SupportState;
  /** Tooltip, from supportCellTitle. */
  title: string;
  evidence?: SupportEvidence;
  /** Shown as a dagger; the sentence goes to screen readers and the tooltip. */
  note?: string;
  'data-testid'?: string;
}

/** One matrix or card cell: the support mark, an optional evidence tag, an optional dagger. */
export default function SupportCellMark({
  state,
  title,
  evidence,
  note,
  'data-testid': testId,
}: SupportCellMarkProps) {
  const evidenceClass =
    evidence != null ? classes[`evidence_${evidence.replace('-', '_')}`] : undefined;
  return (
    <span
      className={classes.cellMark}
      title={title}
      data-testid={testId}
      data-evidence={evidence ?? 'none'}
    >
      <SupportMark state={state} />
      {evidence ? (
        <span className={`${classes.evidenceTag} ${evidenceClass ?? ''}`}>
          {SUPPORT_EVIDENCE_SHORT[evidence]}
        </span>
      ) : null}
      {note ? (
        <>
          <span className={classes.dagger} aria-hidden="true">
            †
          </span>
          <span className={classes.srOnly}>{note}</span>
        </>
      ) : null}
    </span>
  );
}