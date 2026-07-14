import { useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Group, Modal, Stack, Table, Text } from '@mantine/core';
import type { DigitalContact } from '@core/models/library.ts';
import {
  buildDigitalContactPatchFromDiff,
  diffDigitalContactFromListing,
  diffHasChanges,
  type DigitalContactDiffField,
  type RadioidDmrUserListing,
} from '@integrations/radioid/index.ts';
import type { RadioidContactNameMode } from '@integrations/radioid/index.ts';
import { persistence } from '../../state/persistence.ts';
import { useRadioidContactNameMode } from '../../hooks/useRadioidContactNameMode.ts';

export interface RadioidContactUpdateDialogProps {
  contact: DigitalContact;
  listing: RadioidDmrUserListing | null;
  opened: boolean;
  onClose: () => void;
  onApplied?: () => void;
  /** When omitted, uses persisted RadioID import name mode. */
  nameMode?: RadioidContactNameMode;
}

function RadioidContactUpdateDialogBody({
  contact,
  listing,
  onClose,
  onApplied,
  nameMode,
}: {
  contact: DigitalContact;
  listing: RadioidDmrUserListing;
  onClose: () => void;
  onApplied?: () => void;
  nameMode: RadioidContactNameMode;
}) {
  const diffRows = useMemo(
    () => diffDigitalContactFromListing(contact, listing, nameMode),
    [contact, listing, nameMode],
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
    const patched = buildDigitalContactPatchFromDiff(contact, listing, [...selectedFields], nameMode);
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
    <Stack gap="md">
      {changedRows.length === 0 ? (
        <Text c="dimmed">This contact already matches the RadioID.net listing.</Text>
      ) : (
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Apply</Table.Th>
              <Table.Th>Field</Table.Th>
              <Table.Th>Your contact</Table.Th>
              <Table.Th>RadioID.net</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {diffRows.map((row) => (
              <Table.Tr key={row.field} opacity={row.changed ? 1 : 0.55}>
                <Table.Td>
                  <Checkbox
                    checked={selectedFields.has(row.field)}
                    disabled={!row.changed}
                    onChange={(e) => toggleField(row.field, e.currentTarget.checked)}
                  />
                </Table.Td>
                <Table.Td>{row.label}</Table.Td>
                <Table.Td>{row.local}</Table.Td>
                <Table.Td>{row.remote}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      {applyError ? <Alert color="red">{applyError}</Alert> : null}
      <Group justify="flex-end">
        <Button variant="default" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!diffHasChanges(diffRows) || selectedFields.size === 0}
          loading={applying}
          onClick={() => void handleApply()}
        >
          Apply selected
        </Button>
      </Group>
    </Stack>
  );
}

export default function RadioidContactUpdateDialog({
  contact,
  listing,
  opened,
  onClose,
  onApplied,
  nameMode: nameModeProp,
}: RadioidContactUpdateDialogProps) {
  const { nameMode: persistedNameMode } = useRadioidContactNameMode();
  const nameMode = nameModeProp ?? persistedNameMode;
  const bodyKey = listing ? `${contact.id}:${listing.id}:${nameMode}` : 'none';

  return (
    <Modal opened={opened} onClose={onClose} title="RadioID.net comparison" size="lg">
      {opened && listing ? (
        <RadioidContactUpdateDialogBody
          key={bodyKey}
          contact={contact}
          listing={listing}
          onClose={onClose}
          onApplied={onApplied}
          nameMode={nameMode}
        />
      ) : null}
    </Modal>
  );
}
