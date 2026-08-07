import { useMemo, useState } from 'react';
import type { Channel } from '@core/models/library.ts';
import {
  buildPatchFromDiff,
  diffChannelFromListing,
  diffHasChanges,
  type ChannelDiffField,
  type ChannelDiffRow,
  type MapListingOptions,
  type RepeaterListing,
} from '@integrations/repeaters/index.ts';
import { persistence } from '../../state/persistence.ts';
import Button from '../v2/Button.tsx';
import Checkbox from '../v2/Checkbox.tsx';
import ModalShell from '../v2/ModalShell.tsx';
import StatusBanner from '../v2/StatusBanner.tsx';
import classes from './RepeaterListingUpdateDialog.module.css';

export interface RepeaterListingUpdateDialogProps {
  channel: Channel;
  listing: RepeaterListing | null;
  opened: boolean;
  onClose: () => void;
  onApplied?: () => void;
  mapOptions?: MapListingOptions;
}

interface RepeaterListingUpdateDialogBodyProps {
  channel: Channel;
  listing: RepeaterListing;
  onClose: () => void;
  onApplied?: () => void;
  mapOptions?: MapListingOptions;
}

function RepeaterListingUpdateDialogBody({
  channel,
  listing,
  onClose,
  onApplied,
  mapOptions,
}: RepeaterListingUpdateDialogBodyProps) {
  const diffRows: ChannelDiffRow[] = useMemo(
    () => diffChannelFromListing(channel, listing, mapOptions),
    [channel, listing, mapOptions],
  );
  const changedRows = useMemo(() => diffRows.filter((r) => r.changed), [diffRows]);
  const [selectedFields, setSelectedFields] = useState<Set<ChannelDiffField>>(
    () => new Set(diffRows.filter((r) => r.selectByDefault).map((r) => r.field)),
  );
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  function toggleField(field: ChannelDiffField, checked: boolean) {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (checked) next.add(field);
      else next.delete(field);
      return next;
    });
  }

  async function handleApply() {
    if (selectedFields.size === 0) return;
    setApplying(true);
    setApplyError(null);
    const patched = buildPatchFromDiff(channel, listing, [...selectedFields], mapOptions);
    const result = await persistence.putChannel(patched, channel.revision);
    setApplying(false);
    if (!result.ok) {
      setApplyError(
        result.reason === 'revision_conflict'
          ? 'This channel was updated elsewhere. Reload and try again.'
          : 'Could not save changes.',
      );
      return;
    }
    onApplied?.();
    onClose();
  }

  return (
    <div className={classes.body}>
      {changedRows.length === 0 ? (
        <p className={classes.muted}>This channel already matches the selected listing.</p>
      ) : (
        <div className={classes.tableWrap}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th>Apply</th>
                <th>Field</th>
                <th>Your channel</th>
                <th>Directory</th>
              </tr>
            </thead>
            <tbody>
              {diffRows.map((row) => (
                <tr key={row.field} className={row.changed ? undefined : classes.dimRow}>
                  <td>
                    <Checkbox
                      checked={selectedFields.has(row.field)}
                      disabled={!row.changed}
                      onCheckedChange={(checked) => toggleField(row.field, checked)}
                      aria-label={`Apply ${row.label}`}
                    />
                  </td>
                  <td>{row.label}</td>
                  <td>{row.local}</td>
                  <td>{row.remote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {applyError ? <StatusBanner tone="warning">{applyError}</StatusBanner> : null}
      <div className={classes.footer}>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!diffHasChanges(diffRows) || selectedFields.size === 0}
          loading={applying}
          onClick={() => void handleApply()}
        >
          Apply selected
        </Button>
      </div>
    </div>
  );
}

export default function RepeaterListingUpdateDialog({
  channel,
  listing,
  opened,
  onClose,
  onApplied,
  mapOptions,
}: RepeaterListingUpdateDialogProps) {
  const bodyKey = listing ? `${channel.id}:${listing.source}:${listing.remoteId}` : 'none';

  return (
    <ModalShell open={opened} onClose={onClose} title="Directory comparison" size="lg">
      {opened && listing ? (
        <RepeaterListingUpdateDialogBody
          key={bodyKey}
          channel={channel}
          listing={listing}
          onClose={onClose}
          onApplied={onApplied}
          mapOptions={mapOptions}
        />
      ) : null}
    </ModalShell>
  );
}
