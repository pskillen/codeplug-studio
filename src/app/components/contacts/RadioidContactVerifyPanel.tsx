import { useState } from 'react';
import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import type { DigitalContact } from '@core/models/library.ts';
import {
  RadioidDirectoryError,
  searchRadioidDmrUsers,
} from '@integrations/radioid/index.ts';
import { FormSection } from '../ui/index.ts';
import RadioidContactUpdateDialog from './RadioidContactUpdateDialog.tsx';

export interface RadioidContactVerifyPanelProps {
  contact: DigitalContact;
  onApplied?: () => void;
}

export default function RadioidContactVerifyPanel({
  contact,
  onApplied,
}: RadioidContactVerifyPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [listing, setListing] = useState<Awaited<
    ReturnType<typeof searchRadioidDmrUsers>
  >['listings'][number] | null>(null);

  async function handleCheck() {
    setLoading(true);
    setError(null);
    try {
      const byId = await searchRadioidDmrUsers({
        id: String(contact.digitalId),
        id_sel: '=',
        per_page: 5,
      });
      let match = byId.listings.find((row) => row.id === contact.digitalId) ?? null;
      if (!match && contact.callsign.trim()) {
        const byCallsign = await searchRadioidDmrUsers({
          callsign: contact.callsign.trim(),
          callsign_sel: '=',
          per_page: 20,
        });
        match =
          byCallsign.listings.find((row) => row.id === contact.digitalId) ??
          byCallsign.listings.find(
            (row) => row.callsign.toUpperCase() === contact.callsign.trim().toUpperCase(),
          ) ??
          null;
      }
      if (!match) {
        setError('No matching listing on RadioID.net for this contact ID or callsign.');
        return;
      }
      setListing(match);
      setUpdateOpen(true);
    } catch (err) {
      setError(err instanceof RadioidDirectoryError ? err.message : 'RadioID.net lookup failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <FormSection title="RadioID.net">
      <Text size="sm" c="dimmed">
        Compare this contact against the RadioID.net directory and apply updated metadata.
      </Text>
      {error ? (
        <Alert color="red" title="RadioID.net">
          {error}
        </Alert>
      ) : null}
      <Group>
        <Button loading={loading} variant="light" onClick={() => void handleCheck()}>
          Update from RadioID.net
        </Button>
      </Group>
      <RadioidContactUpdateDialog
        contact={contact}
        listing={listing}
        opened={updateOpen}
        onClose={() => setUpdateOpen(false)}
        onApplied={onApplied}
      />
    </FormSection>
  );
}
