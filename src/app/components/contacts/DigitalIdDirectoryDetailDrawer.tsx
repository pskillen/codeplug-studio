import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import type { DigitalContact } from '@core/models/library.ts';
import { findDigitalContactByDigitalId } from '@integrations/radioid/index.ts';
import { addDirectoryEntryToContacts } from '../../lib/copyDirectoryEntryToLibrary.ts';
import { persistence } from '../../state/persistence.ts';
import Button from '../v2/Button.tsx';
import ModalShell from '../v2/ModalShell.tsx';
import StatusBanner from '../v2/StatusBanner.tsx';
import classes from './DigitalIdDirectoryDetailDrawer.module.css';

export interface DigitalIdDirectoryDetailDrawerProps {
  entry: DigitalIdDirectoryEntry | null;
  libraryContacts: DigitalContact[];
  opened: boolean;
  onClose: () => void;
  onCopied?: (contactId: string) => void;
}

function FieldRow({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? `${classes.field} ${classes.wide}` : classes.field}>
      <dt className={classes.fieldLabel}>{label}</dt>
      <dd className={classes.fieldValue}>{value || '—'}</dd>
    </div>
  );
}

export default function DigitalIdDirectoryDetailDrawer({
  entry,
  libraryContacts,
  opened,
  onClose,
  onCopied,
}: DigitalIdDirectoryDetailDrawerProps) {
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addedDigitalId, setAddedDigitalId] = useState<number | null>(null);

  if (!entry) return null;

  const existingContact = findDigitalContactByDigitalId(libraryContacts, entry.digitalId);
  const justAdded = addedDigitalId === entry.digitalId;

  function handleClose() {
    setAddError(null);
    setAddedDigitalId(null);
    onClose();
  }

  async function handleAdd() {
    setAdding(true);
    setAddError(null);
    const result = await addDirectoryEntryToContacts(entry!, libraryContacts, (row, revision) =>
      persistence.putDigitalContact(row, revision),
    );
    setAdding(false);
    if (result.kind === 'error') {
      setAddError('Could not save the contact — try again.');
      return;
    }
    if (result.kind === 'added') {
      setAddedDigitalId(entry!.digitalId);
      onCopied?.(result.contactId);
    }
  }

  const footer = (
    <>
      <Button variant="secondary" onClick={handleClose} disabled={adding}>
        Close
      </Button>
      <Button
        variant="secondary"
        onClick={() => navigate('/library/contacts/add-from-radioid')}
        disabled={adding}
      >
        Fetch from RadioID.net
      </Button>
      {existingContact ? (
        <Button
          variant="primary"
          onClick={() => navigate(`/library/digital-contacts/${existingContact.id}`)}
        >
          Open contact
        </Button>
      ) : (
        <Button variant="primary" onClick={() => void handleAdd()} loading={adding}>
          Add to contacts
        </Button>
      )}
    </>
  );

  return (
    <ModalShell
      open={opened}
      onClose={handleClose}
      title={entry.name || `DMR ID ${entry.digitalId}`}
      size="md"
      footer={footer}
    >
      <div className={classes.body}>
        <p className={classes.muted}>
          Lookup-only entry from your ID directory. Add it to contacts to select, call, or put it on
          channels and RX lists.
        </p>

        {justAdded ? <StatusBanner tone="success">Added to contacts.</StatusBanner> : null}
        {existingContact && !justAdded ? (
          <StatusBanner tone="info">
            DMR ID {entry.digitalId} is already in your contacts.
          </StatusBanner>
        ) : null}
        {addError ? <StatusBanner tone="warning">{addError}</StatusBanner> : null}

        <dl className={classes.fields}>
          <FieldRow label="Callsign" value={entry.callsign} />
          <FieldRow label="DMR ID" value={String(entry.digitalId)} />
          <FieldRow label="Name" value={entry.name} wide />
          <FieldRow label="City" value={entry.city} />
          <FieldRow label="State" value={entry.state} />
          <FieldRow label="Country" value={entry.country} />
          <FieldRow label="Mode" value={entry.mode.toUpperCase()} />
          <FieldRow label="Remarks" value={entry.remarks ?? ''} wide />
          {entry.fetchedAt ? (
            <FieldRow label="Fetched" value={new Date(entry.fetchedAt).toLocaleString()} wide />
          ) : null}
        </dl>
      </div>
    </ModalShell>
  );
}
