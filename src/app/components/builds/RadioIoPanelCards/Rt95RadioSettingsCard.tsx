import { useNavigate } from 'react-router-dom';
import type { EgressPath } from '@core/models/egressPath.ts';
import {
  rt95OverrideCount,
  useRt95RadioSettingsSession,
} from '../../../state/rt95RadioSettingsSession.ts';
import { Button } from '../../v2/index.ts';
import Rt95RadioSettingsReadButton from '../Rt95RadioSettingsReadButton.tsx';
import classes from './RadioIoPanelCards.module.css';

export interface Rt95RadioSettingsCardProps {
  buildId: string;
  egress: EgressPath;
}

/** RT95: this session's radio-setting changes, Edit settings, and Read a radio. */
export default function Rt95RadioSettingsCard({ buildId, egress }: Rt95RadioSettingsCardProps) {
  const navigate = useNavigate();
  const session = useRt95RadioSettingsSession(buildId);
  const n = rt95OverrideCount(session.overrides);
  const readSuffix =
    session.read !== undefined
      ? ` · read at ${new Date(session.read.readAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}`
      : '';
  const line =
    n > 0
      ? `${n} ${n === 1 ? 'change' : 'changes'} this session${readSuffix}`
      : session.read
        ? `No changes${readSuffix}`
        : 'Your radios keep their own settings';
  return (
    <section className={classes.card} aria-label="Radio settings">
      <h3 className={classes.cardTitle}>Radio settings</h3>
      <p className={classes.line}>{line}</p>
      <div className={classes.actions}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate(`/builds/${buildId}/export/radio-settings`)}
        >
          Edit settings
        </Button>
        <Rt95RadioSettingsReadButton buildId={buildId} egress={egress} variant="secondary" />
      </div>
    </section>
  );
}
