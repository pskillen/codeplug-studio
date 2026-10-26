import { useNavigate } from 'react-router-dom';
import type { EgressPath } from '@core/models/egressPath.ts';
import {
  atD890OverrideCount,
  useAtD890RadioSettingsSession,
} from '../../../state/atD890RadioSettingsSession.ts';
import { Button } from '../../v2/index.ts';
import AtD890RadioSettingsReadButton from '../AtD890RadioSettingsReadButton.tsx';
import classes from './RadioIoPanelCards.module.css';

export interface AtD890RadioSettingsCardProps {
  buildId: string;
  egress: EgressPath;
}

/** AT-D890UV only: this session's radio-setting changes, Edit settings, and Read a radio. */
export default function AtD890RadioSettingsCard({ buildId, egress }: AtD890RadioSettingsCardProps) {
  const navigate = useNavigate();
  const session = useAtD890RadioSettingsSession(buildId);
  const n = atD890OverrideCount(session.overrides);
  const readName = session.read?.masterIdName.trim();
  const readSuffix = readName ? ` · read from ${readName}` : '';
  const line =
    n > 0
      ? `${n} ${n === 1 ? 'change' : 'changes'} this session${readSuffix}`
      : readName
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
        <AtD890RadioSettingsReadButton buildId={buildId} egress={egress} variant="secondary" />
      </div>
    </section>
  );
}
