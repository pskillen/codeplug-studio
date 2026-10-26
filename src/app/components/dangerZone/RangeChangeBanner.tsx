import { useNavigate } from 'react-router-dom';
import type { RangeChangeJournalEntry } from '@integrations/persistence/rangeChangeJournal.ts';
import {
  unfinishedRangeChanges,
  useRangeChangeJournal,
} from '../../state/atD890RangeChangeJournal.ts';
import {
  clock,
  COPY,
  rangeCaption,
} from '../../routes/builds/danger-zone/rangeChange/rangeChangeCopy.ts';
import { Button } from '../v2/index.ts';
import classes from './RangeChangeBanner.module.css';

export interface RangeChangeBannerProps {
  buildId: string;
  /** Show only for this serial. Omit to show every unfinished record. */
  serial?: string;
}

function bannerText(e: RangeChangeJournalEntry): string {
  const args = ['AT-D890UV', e.serial, rangeCaption(e.toCode), clock(e.updatedAt)] as const;
  return e.stage === 'restored' ? COPY.banner.restored(...args) : COPY.banner.sending(...args);
}

/**
 * Red one-line banner with a button for an unfinished range change on record in this browser (stage `sending`,
 * `changed` or `restored`). Shown on the Danger zone page, the AT-D890 Export panel and the Backup / Restore
 * page. Renders nothing when the journal is empty or storage is unavailable.
 */
export default function RangeChangeBanner({ buildId, serial }: RangeChangeBannerProps) {
  const entries = unfinishedRangeChanges(useRangeChangeJournal()).filter(
    (e) => serial === undefined || e.serial === serial,
  );
  const navigate = useNavigate();
  if (entries.length === 0) return null;
  return (
    <div className={classes.list}>
      {entries.map((e) => (
        <div
          key={e.serial}
          className={classes.banner}
          role="alert"
          data-testid="range-change-banner"
        >
          <p className={classes.text}>{bannerText(e)}</p>
          <Button
            size="sm"
            onClick={() =>
              navigate(`/builds/${buildId}/export/danger-zone/frequency-range/resume`, {
                state: { serial: e.serial },
              })
            }
          >
            {e.stage === 'restored' ? COPY.banner.check : COPY.banner.resume}
          </Button>
        </div>
      ))}
    </div>
  );
}
