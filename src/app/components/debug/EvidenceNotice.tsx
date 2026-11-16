import { useState } from 'react';
import type { EvidenceNoticeView } from '@integrations/radio-io/debugView';
import classes from './EvidenceNotice.module.css';

/** Lines shown before the rest fold behind **More**. */
export const EVIDENCE_NOTICE_VISIBLE_LINES = 2;

export interface EvidenceNoticeProps {
  notice: EvidenceNoticeView;
}

/** The one "not validated on hardware" notice per debug tab. Radio-neutral: text comes from the view. */
export default function EvidenceNotice({ notice }: EvidenceNoticeProps) {
  const [open, setOpen] = useState(false);
  const folds = notice.lines.length > EVIDENCE_NOTICE_VISIBLE_LINES;
  const shown =
    folds && !open ? notice.lines.slice(0, EVIDENCE_NOTICE_VISIBLE_LINES) : notice.lines;
  return (
    <div
      role="note"
      className={[classes.root, notice.tone === 'caution' ? classes.caution : classes.info].join(
        ' ',
      )}
      data-tone={notice.tone}
    >
      <p className={classes.title}>{notice.title}</p>
      {shown.map((line, i) => (
        <p key={i} className={classes.line}>
          {line}
        </p>
      ))}
      {folds ? (
        <button
          type="button"
          className={classes.more}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? 'Less' : 'More'}
        </button>
      ) : null}
    </div>
  );
}
