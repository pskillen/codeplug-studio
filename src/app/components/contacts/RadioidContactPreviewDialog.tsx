import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DigitalContact } from '@core/models/library.ts';
import type { RadioidDmrUserListing } from '@integrations/radioid/index.ts';
import Button from '../v2/Button.tsx';
import ConfirmModal from '../v2/ConfirmModal.tsx';
import ModalShell from '../v2/ModalShell.tsx';
import RadioidContactUpdateDialog from './RadioidContactUpdateDialog.tsx';
import classes from '../repeaters/RepeaterListingUpdateDialog.module.css';

export interface RadioidContactPreviewDialogProps {
  contact: DigitalContact | null;
  listing: RadioidDmrUserListing | null;
  opened: boolean;
  onClose: () => void;
  onApplied?: () => void;
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={classes.fieldRow}>
      <span className={classes.fieldLabel}>{label}</span>
      <span className={classes.fieldValue}>{value || '—'}</span>
    </div>
  );
}

export default function RadioidContactPreviewDialog({
  contact,
  listing,
  opened,
  onClose,
  onApplied,
}: RadioidContactPreviewDialogProps) {
  const navigate = useNavigate();
  const [openConfirm, setOpenConfirm] = useState(false);
  const [updateOpen, setUpdateOpen] = useState(false);

  if (!contact) return null;

  const contactId = contact.id;

  function handleOpenEditor() {
    setOpenConfirm(false);
    onClose();
    navigate(`/library/digital-contacts/${contactId}`);
  }

  return (
    <>
      <ModalShell open={opened} onClose={onClose} title="Library contact" size="md">
        <div className={classes.body}>
          <p className={classes.muted}>
            This contact is already in your library. Details below are from your saved record.
          </p>
          <FieldRow label="Name" value={contact.name} />
          <FieldRow label="Callsign" value={contact.callsign} />
          <FieldRow label="DMR ID" value={String(contact.digitalId)} />
          <FieldRow label="City" value={contact.city} />
          <FieldRow label="State" value={contact.state} />
          <FieldRow label="Country" value={contact.country} />
          <FieldRow label="Remarks" value={contact.remarks} />
          <FieldRow label="Comment" value={contact.comment} />
          <div className={classes.footer}>
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {listing ? (
              <Button variant="secondary" onClick={() => setUpdateOpen(true)}>
                Update from RadioID.net
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setOpenConfirm(true)}>
              Open in editor
            </Button>
          </div>
        </div>
      </ModalShell>

      <ConfirmModal
        open={openConfirm}
        onClose={() => setOpenConfirm(false)}
        onConfirm={handleOpenEditor}
        title="Leave search results?"
        confirmLabel="Open in editor"
        cancelLabel="Stay on search"
      >
        Opening the contact editor navigates away from this page. You will need to run your
        RadioID.net search again.
      </ConfirmModal>

      {listing ? (
        <RadioidContactUpdateDialog
          contact={contact}
          listing={listing}
          opened={updateOpen}
          onClose={() => setUpdateOpen(false)}
          onApplied={() => {
            onApplied?.();
            setUpdateOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
