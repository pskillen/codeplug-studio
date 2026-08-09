import { Link } from 'react-router-dom';
import type { Channel } from '@core/models/library.ts';
import type { DataTableColumn } from '../v2/DataTable.tsx';
import ChannelListDeleteAction from './ChannelListDeleteAction.tsx';
import classes from './ChannelCard.module.css';

export interface ChannelCardProps {
  channel: Channel;
  /** Rendered as labeled rows below the name/callsign header, in order — typically the caller's currently-visible optional columns. */
  fieldColumns: DataTableColumn<Channel>[];
}

/** One channel rendered as a stacked-field card instead of a table row — for narrow viewports (`DataTable`'s `mobileCard`) and zone-grouped card sections. */
export default function ChannelCard({ channel, fieldColumns }: ChannelCardProps) {
  return (
    <div className={classes.card}>
      <div className={classes.header}>
        <Link to={`/library/channels/${channel.id}`} className={classes.name}>
          {channel.name || '—'}
        </Link>
        <ChannelListDeleteAction channel={channel} />
      </div>
      {fieldColumns.length > 0 ? (
        <dl className={classes.fields}>
          {fieldColumns.map((col) => (
            <div key={col.key} className={classes.fieldRow}>
              <dt className={classes.fieldLabel}>{col.header}</dt>
              <dd className={classes.fieldValue}>{col.render(channel)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
