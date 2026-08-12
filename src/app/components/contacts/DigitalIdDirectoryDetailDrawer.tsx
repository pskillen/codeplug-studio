import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import type { DigitalContact } from '@core/models/library.ts';
import { prepareCopyDirectoryEntryToLibrary } from '../../lib/copyDirectoryEntryToLibrary.ts';
import { persistence } from '../../state/persistence.ts';
import Button from '../v2/Button.tsx';
import ModalShell from '../v2/ModalShell.tsx';
import StatusBanner from '../v2/StatusBanner.tsx';
import classes from '../repeaters/RepeaterListingUpdateDialog.module.css';

export interface DigitalIdDirectoryDetailDrawerProps {
  entry: DigitalIdDirectoryEntry | null;
  libraryContacts: DigitalContact[];
  opened: boolean;
  onClose: () => void;
  onCopied?: (contactId: string) => void;
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={classes.fieldRow}>
      <span className={classes.fieldLabel}>{label}</span>
      <span className={classes.fieldValue}>{value || '—'}</span>
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
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [duplicateContactId, setDuplicateContactId] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  if (!entry) return null;

  async function handleCopy() {
    setCopying(true);
    setCopyError(null);
    setDuplicateContactId(null);
    setCopySuccess(null);

    const prepared = prepareCopyDirectoryEntryToLibrary(entry!, libraryContacts);
    if (prepared.kind === 'duplicate') {
      setDuplicateContactId(prepared.existingContactId);
      setCopying(false);
      return;
    }

    try {
      const result = await persistence.putDigitalContact(prepared.contact, null);
      if (!result.ok) {
        setCopyError('Could not save the library contact — try again.');
        return;
      }
      const contactId = prepared.contact.id;
      setCopySuccess('Copied to library contacts.');
      onCopied?.(contactId);
      navigate(`/library/digital-contacts/${contactId}`);
    } catch {
      setCopyError('Could not save the library contact — try again.');
    } finally {
      setCopying(false);
    }
  }

  return (
    <ModalShell
      open={opened}
      onClose={onClose}
      title={entry.name || `DMR ID ${entry.digitalId}`}
      size="md"
    >
      <div className={classes.body}>
        <p className={classes.muted}>
          Read-only directory row from your local RadioID shadow store. Copy creates a new library
          contact with a fresh id for channels and export.
        </p>

        <FieldRow label="Name" value={entry.name} />
        <FieldRow label="Callsign" value={entry.callsign} />
        <FieldRow label="DMR ID" value={String(entry.digitalId)} />
        <FieldRow label="Mode" value={entry.mode.toUpperCase()} />
        <FieldRow label="City" value={entry.city} />
        <FieldRow label="State" value={entry.state} />
        <FieldRow label="Country" value={entry.country} />
        <FieldRow label="Remarks" value={entry.remarks ?? ''} />
        {entry.fetchedAt ? (
          <FieldRow label="Fetched" value={new Date(entry.fetchedAt).toLocaleString()} />
        ) : null}

        {duplicateContactId ? (
          <StatusBanner tone="warning">
            A library contact with DMR ID {entry.digitalId} already exists. Open the existing
            contact instead of copying a duplicate.
          </StatusBanner>
        ) : null}
        {copyError ? <StatusBanner tone="warning">{copyError}</StatusBanner> : null}
        {copySuccess ? <StatusBanner tone="success">{copySuccess}</StatusBanner> : null}

        <div className={classes.footer}>
          <Button variant="secondary" onClick={onClose} disabled={copying}>
            Close
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate('/library/contacts/add-from-radioid')}
            disabled={copying}
          >
            Refresh from RadioID.net
          </Button>
          {duplicateContactId ? (
            <Button
              variant="outline"
              onClick={() => navigate(`/library/digital-contacts/${duplicateContactId}`)}
            >
              Open existing contact
            </Button>
          ) : (
            <Button variant="primary" onClick={() => void handleCopy()} loading={copying}>
              Copy to library
            </Button>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
