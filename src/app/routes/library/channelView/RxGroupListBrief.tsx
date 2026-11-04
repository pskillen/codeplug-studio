import { Link } from 'react-router-dom';
import type { Library } from '@core/models/library.ts';
import {
  formatTimeSlotOverride,
  resolveRxGroupListMemberDisplay,
} from '../../../lib/rxGroupListMembers.ts';
import classes from './RxGroupListBrief.module.css';

/** Members shown as chips before the "+N more" link. */
export const RX_GROUP_LIST_BRIEF_LIMIT = 12;

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Compact, read-only summary of a channel's RX group list for the channel view: the list name
 * (linked), member counts by kind and timeslot, then the first members as chips.
 */
export default function RxGroupListBrief({
  listId,
  library,
}: {
  listId: string;
  library: Library;
}) {
  const list = library.rxGroupLists.find((row) => row.id === listId);
  if (!list) {
    return <p className={classes.muted}>RX group list not found.</p>;
  }

  const rows = list.members.map((member) => resolveRxGroupListMemberDisplay(member, library));
  const talkGroups = rows.filter((r) => r.kindLabel === 'Talk group').length;
  const contacts = rows.length - talkGroups;
  const ts1 = rows.filter((r) => r.timeSlotOverride === 1).length;
  const ts2 = rows.filter((r) => r.timeSlotOverride === 2).length;
  const counts = [
    talkGroups > 0 ? plural(talkGroups, 'talk group', 'talk groups') : null,
    contacts > 0 ? plural(contacts, 'contact', 'contacts') : null,
    ts1 > 0 ? `${ts1} on TS1` : null,
    ts2 > 0 ? `${ts2} on TS2` : null,
  ].filter(Boolean);
  const shown = rows.slice(0, RX_GROUP_LIST_BRIEF_LIMIT);
  const hidden = rows.length - shown.length;
  const listPath = `/library/rx-group-lists/${list.id}`;

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <span className={classes.label}>RX group list</span>
        <Link to={listPath}>{list.name || 'Untitled list'}</Link>
      </div>
      <p className={classes.muted}>{counts.length > 0 ? counts.join(' · ') : 'No members'}</p>
      {shown.length > 0 ? (
        <ul className={classes.chips} aria-label={`${list.name} members`}>
          {shown.map((row) => (
            <li
              key={`${row.ref.kind}:${row.ref.id}`}
              className={[classes.chip, row.brokenRef ? classes.broken : ''].join(' ')}
            >
              {row.name}
              {row.digitalId != null ? <span className={classes.id}>{row.digitalId}</span> : null}
              {row.timeSlotOverride ? (
                <span className={classes.ts}>{formatTimeSlotOverride(row.timeSlotOverride)}</span>
              ) : null}
            </li>
          ))}
          {hidden > 0 ? (
            <li>
              <Link to={listPath} className={classes.more}>
                +{hidden} more
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
