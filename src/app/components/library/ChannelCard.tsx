import { Link } from 'react-router-dom';
import type { Channel } from '@core/models/library.ts';
import { Checkbox } from '../v2/index.ts';
import type { DataTableColumn } from '../v2/DataTable.tsx';
import ChannelListDeleteAction from './ChannelListDeleteAction.tsx';
import classes from './ChannelCard.module.css';

export interface ChannelCardProps {
  channel: Channel;
  /** Rendered as labeled rows below the name/callsign header, in order. */
  fieldColumns: DataTableColumn<Channel>[];
  /** When set with `onSelectedChange`, shows a row-selection checkbox. */
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
}

/** One channel rendered as a stacked-field card instead of a table row. */
export default function ChannelCard({
  channel,
  fieldColumns,
  selected,
  onSelectedChange,
}: ChannelCardProps) {
  const callsign = channel.callsign.trim();
  const showSelection = onSelectedChange != null;

  return (
    <div className={classes.card}>
      <div className={classes.header}>
        <div className={classes.headerMain}>
          {showSelection ? (
            <Checkbox
              checked={selected ?? false}
              onCheckedChange={onSelectedChange}
              aria-label={`Select ${channel.name || 'channel'}`}
              onClick={(event) => event.stopPropagation()}
            />
          ) : null}
          <div className={classes.titleBlock}>
            <Link to={`/library/channels/${channel.id}`} className={classes.name}>
              {channel.name || '—'}
            </Link>
            {callsign ? <div className={classes.callsign}>{callsign}</div> : null}
          </div>
        </div>
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
