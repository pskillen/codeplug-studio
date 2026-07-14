import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import type { DigitalContact } from '@core/models/library.ts';
import type { RadioidDmrUserListing } from '@integrations/radioid/index.ts';
import RadioidContactUpdateDialog from './RadioidContactUpdateDialog.tsx';

export interface RadioidContactPreviewDialogProps {
  contact: DigitalContact | null;
  listing: RadioidDmrUserListing | null;
  opened: boolean;
  onClose: () => void;
  onApplied?: () => void;
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <Group justify="space-between" align="flex-start" wrap="nowrap">
      <Text size="sm" c="dimmed" w={120}>
        {label}
      </Text>
      <Text size="sm" style={{ flex: 1 }}>
        {value || '—'}
      </Text>
    </Group>
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
      <Modal opened={opened} onClose={onClose} title="Library contact" size="md">
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            This contact is already in your library. Details below are from your saved record.
          </Text>
          <FieldRow label="Name" value={contact.name} />
          <FieldRow label="Callsign" value={contact.callsign} />
          <FieldRow label="DMR ID" value={String(contact.digitalId)} />
          <FieldRow label="City" value={contact.city} />
          <FieldRow label="State" value={contact.state} />
          <FieldRow label="Country" value={contact.country} />
          <FieldRow label="Remarks" value={contact.remarks} />
          <FieldRow label="Comment" value={contact.comment} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Close
            </Button>
            {listing ? (
              <Button variant="light" onClick={() => setUpdateOpen(true)}>
                Update from RadioID.net
              </Button>
            ) : null}
            <Button variant="outline" onClick={() => setOpenConfirm(true)}>
              Open in editor
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={openConfirm}
        onClose={() => setOpenConfirm(false)}
        title="Leave search results?"
        size="sm"
      >
        <Stack gap="md">
          <Alert color="yellow" title="Search will be lost">
            Opening the contact editor navigates away from this page. You will need to run your
            RadioID.net search again.
          </Alert>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpenConfirm(false)}>
              Stay on search
            </Button>
            <Button onClick={handleOpenEditor}>Open in editor</Button>
          </Group>
        </Stack>
      </Modal>

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
