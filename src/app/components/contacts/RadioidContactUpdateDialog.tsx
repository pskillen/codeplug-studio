import { useMemo, useState } from 'react';
import type { DigitalContact } from '@core/models/library.ts';
import {
  buildDigitalContactPatchFromDiff,
  diffDigitalContactFromListing,
  diffHasChanges,
  type DigitalContactDiffField,
  type RadioidDmrUserListing,
} from '@integrations/radioid/index.ts';
import { persistence } from '../../state/persistence.ts';
import Button from '../v2/Button.tsx';
import Checkbox from '../v2/Checkbox.tsx';
import ModalShell from '../v2/ModalShell.tsx';
import StatusBanner from '../v2/StatusBanner.tsx';
import classes from '../repeaters/RepeaterListingUpdateDialog.module.css';

export interface RadioidContactUpdateDialogProps {
  contact: DigitalContact;
  listing: RadioidDmrUserListing | null;
  opened: boolean;
  onClose: () => void;
  onApplied?: () => void;
}

function RadioidContactUpdateDialogBody({
  contact,
  listing,
  onClose,
  onApplied,
}: {
  contact: DigitalContact;
  listing: RadioidDmrUserListing;
  onClose: () => void;
  onApplied?: () => void;
}) {
  const diffRows = useMemo(
    () => diffDigitalContactFromListing(contact, listing),
    [contact, listing],
  );
  const changedRows = useMemo(() => diffRows.filter((r) => r.changed), [diffRows]);
  const [selectedFields, setSelectedFields] = useState<Set<DigitalContactDiffField>>(
    () => new Set(diffRows.filter((r) => r.selectByDefault).map((r) => r.field)),
  );
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  function toggleField(field: DigitalContactDiffField, checked: boolean) {
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
    const patched = buildDigitalContactPatchFromDiff(contact, listing, [...selectedFields]);
    const result = await persistence.putDigitalContact(patched, contact.revision);
    setApplying(false);
    if (!result.ok) {
      setApplyError(
        result.reason === 'revision_conflict'
          ? 'This contact was updated elsewhere. Reload and try again.'
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
        <p className={classes.muted}>This contact already matches the RadioID.net listing.</p>
      ) : (
        <div className={classes.tableWrap}>
          <table className={classes.table}>
            <thead>
              <tr>
                <th>Apply</th>
                <th>Field</th>
                <th>Your contact</th>
                <th>RadioID.net</th>
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

export default function RadioidContactUpdateDialog({
  contact,
  listing,
  opened,
  onClose,
  onApplied,
}: RadioidContactUpdateDialogProps) {
  const bodyKey = listing ? `${contact.id}:${listing.id}` : 'none';

  return (
    <ModalShell open={opened} onClose={onClose} title="RadioID.net comparison" size="lg">
      {opened && listing ? (
        <RadioidContactUpdateDialogBody
          key={bodyKey}
          contact={contact}
          listing={listing}
          onClose={onClose}
          onApplied={onApplied}
        />
      ) : null}
    </ModalShell>
  );
}
