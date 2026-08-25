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
import Pill from '../v2/Pill.tsx';
import StatusBanner from '../v2/StatusBanner.tsx';
import classes from './RepeaterListingUpdateDialog.module.css';

/** Copy variant — 'verify' (default) is today's "check against a directory" framing for a
 * saved channel; 'lookup' swaps to an "import" framing for a blank New channel. See
 * hl-delivery-plan.md — Naming — "Verify" vs "look up" vs "import". */
export type RepeaterListingUpdateDialogMode = 'verify' | 'lookup';

export interface RepeaterListingUpdateDialogProps {
  channel: Channel;
  listing: RepeaterListing | null;
  opened: boolean;
  onClose: () => void;
  /** Primary button — "Apply & save". Persists the patched Channel via
   * persistence.putChannel(patched, channel.revision) — today's behaviour, unchanged.
   * Omit to hide the button (no consumer needs to yet). */
  onApplyAndSave?: (patched: Channel) => void;
  /** Secondary button — "Apply only". Hands back the patched Channel, writes nothing.
   * Omit to hide the button (only the channel editor's New-channel screen needs it today). */
  onApplyAndContinue?: (patched: Channel) => void;
  mapOptions?: MapListingOptions;
  mode?: RepeaterListingUpdateDialogMode;
}

interface RepeaterListingUpdateDialogBodyProps {
  channel: Channel;
  listing: RepeaterListing;
  onClose: () => void;
  onApplyAndSave?: (patched: Channel) => void;
  onApplyAndContinue?: (patched: Channel) => void;
  mapOptions?: MapListingOptions;
}

function RepeaterListingUpdateDialogBody({
  channel,
  listing,
  onClose,
  onApplyAndSave,
  onApplyAndContinue,
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

  function buildPatch(): Channel {
    return buildPatchFromDiff(channel, listing, [...selectedFields], mapOptions);
  }

  async function handleApplyAndSave() {
    if (selectedFields.size === 0 || !onApplyAndSave) return;
    setApplying(true);
    setApplyError(null);
    const patched = buildPatch();
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
    onApplyAndSave(patched);
    onClose();
  }

  function handleApplyAndContinue() {
    if (selectedFields.size === 0 || !onApplyAndContinue) return;
    onApplyAndContinue(buildPatch());
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
                  <td>
                    {row.emphasis === 'warning' ? (
                      <Pill tone="warning">{row.remote}</Pill>
                    ) : (
                      row.remote
                    )}
                  </td>
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
        {onApplyAndContinue ? (
          <Button
            variant="secondary"
            disabled={!diffHasChanges(diffRows) || selectedFields.size === 0}
            onClick={handleApplyAndContinue}
          >
            Apply only
          </Button>
        ) : null}
        {onApplyAndSave ? (
          <Button
            disabled={!diffHasChanges(diffRows) || selectedFields.size === 0}
            loading={applying}
            onClick={() => void handleApplyAndSave()}
          >
            Apply & save
          </Button>
        ) : null}
      </div>
    </div>
  );
}

const DIALOG_TITLES: Record<RepeaterListingUpdateDialogMode, string> = {
  verify: 'Directory comparison',
  lookup: 'Import from directory',
};

export default function RepeaterListingUpdateDialog({
  channel,
  listing,
  opened,
  onClose,
  onApplyAndSave,
  onApplyAndContinue,
  mapOptions,
  mode = 'verify',
}: RepeaterListingUpdateDialogProps) {
  const bodyKey = listing ? `${channel.id}:${listing.source}:${listing.remoteId}` : 'none';

  return (
    <ModalShell open={opened} onClose={onClose} title={DIALOG_TITLES[mode]} size="lg">
      {opened && listing ? (
        <RepeaterListingUpdateDialogBody
          key={bodyKey}
          channel={channel}
          listing={listing}
          onClose={onClose}
          onApplyAndSave={onApplyAndSave}
          onApplyAndContinue={onApplyAndContinue}
          mapOptions={mapOptions}
        />
      ) : null}
    </ModalShell>
  );
}
