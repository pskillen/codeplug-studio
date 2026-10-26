import { IconAlertTriangle, IconCircleCheck, IconInfoCircle } from '@tabler/icons-react';
import { Button } from '../../../../../components/v2/index.ts';
import { NOTHING_CHANGED, COPY } from '../rangeChangeCopy.ts';
import classes from '../RangeChange.module.css';
import type { RangeChangeActions, RangeChangeNotice } from '../types.ts';

const ICON = {
  refusal: IconAlertTriangle,
  warning: IconAlertTriangle,
  info: IconInfoCircle,
  success: IconCircleCheck,
} as const;

/** A refusal, failure or finding of any step: the words, "Nothing has changed." where it is true, and Copy details. */
export default function NoticeBlock({
  notice,
  actions,
}: {
  notice: RangeChangeNotice;
  actions: Pick<RangeChangeActions, 'onCopyDetails'>;
}) {
  const Icon = ICON[notice.tone];
  const bodyHasNothing = notice.body.includes(NOTHING_CHANGED);
  return (
    <div
      className={notice.tone === 'refusal' ? classes.scary : classes.amber}
      role={notice.tone === 'refusal' ? 'alert' : 'status'}
      data-testid={`range-notice-${notice.kind}`}
    >
      <Icon size={16} aria-hidden style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
      {notice.title ? <strong>{notice.title}</strong> : null}
      {notice.body}
      {notice.nothingChanged && !bodyHasNothing ? ` ${NOTHING_CHANGED}` : ''}
      {notice.details ? (
        <div style={{ marginTop: 8 }}>
          <Button variant="ghost" size="sm" onClick={actions.onCopyDetails}>
            {COPY.restart.copyDetails}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
