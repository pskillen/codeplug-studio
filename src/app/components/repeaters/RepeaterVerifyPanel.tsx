import { useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Group, Modal, Radio, Stack, Table, Text } from '@mantine/core';
import type { Channel } from '@core/models/library.ts';
import {
  RepeaterDirectoryError,
  buildPatchFromDiff,
  diffChannelFromListing,
  diffHasChanges,
  searchBrandmeisterByCallsign,
  searchUkRepeatersByCallsign,
  type ChannelDiffField,
  type ChannelDiffRow,
  type RepeaterListing,
} from '@integrations/repeaters/index.ts';
import { persistence } from '../../state/persistence.ts';
import { PageSection } from '../ui/index.ts';

export interface RepeaterVerifyPanelProps {
  channel: Channel;
}

function sourceForChannel(channel: Channel): 'ukrepeater' | 'brandmeister' {
  const mode = channel.modeProfiles[0]?.mode;
  return mode === 'dmr' ? 'brandmeister' : 'ukrepeater';
}

export default function RepeaterVerifyPanel({ channel }: RepeaterVerifyPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listings, setListings] = useState<RepeaterListing[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<RepeaterListing | null>(null);
  const [selectedFields, setSelectedFields] = useState<Set<ChannelDiffField>>(new Set());
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const source = sourceForChannel(channel);
  const sourceLabel = source === 'ukrepeater' ? 'ukrepeater.net' : 'BrandMeister';

  const diffRows: ChannelDiffRow[] = useMemo(() => {
    if (!selectedListing) return [];
    return diffChannelFromListing(channel, selectedListing);
  }, [channel, selectedListing]);

  const changedRows = useMemo(() => diffRows.filter((r) => r.changed), [diffRows]);

  const openDiffForListing = (listing: RepeaterListing) => {
    setSelectedListing(listing);
    const rows = diffChannelFromListing(channel, listing);
    const changed = rows.filter((r) => r.changed).map((r) => r.field);
    setSelectedFields(new Set(changed));
    setApplyError(null);
    setDiffOpen(true);
  };

  const handleCheck = async () => {
    if (!channel.callsign.trim()) {
      setError('Enter a callsign on this channel before checking the directory.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results =
        source === 'brandmeister'
          ? await searchBrandmeisterByCallsign(channel.callsign)
          : await searchUkRepeatersByCallsign(channel.callsign);
      if (results.length === 0) {
        setError(`No listings found for ${channel.callsign} on ${sourceLabel}.`);
        return;
      }
      if (results.length === 1) {
        openDiffForListing(results[0]!);
        return;
      }
      setListings(results);
      setPickerOpen(true);
    } catch (err) {
      setError(
        err instanceof RepeaterDirectoryError ? err.message : `Could not query ${sourceLabel}.`,
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleField = (field: ChannelDiffField, checked: boolean) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (checked) next.add(field);
      else next.delete(field);
      return next;
    });
  };

  const handleApply = async () => {
    if (!selectedListing || selectedFields.size === 0) return;
    setApplying(true);
    setApplyError(null);
    const patched = buildPatchFromDiff(channel, selectedListing, [...selectedFields]);
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
    setDiffOpen(false);
  };

  return (
    <PageSection
      title="Check against directory"
      description={`Compare this channel with ${sourceLabel} and apply selected field updates.`}
    >
      <Stack gap="sm">
        <Group>
          <Button variant="light" loading={loading} onClick={() => void handleCheck()}>
            Check {sourceLabel}
          </Button>
        </Group>
        {error ? <Alert color="red">{error}</Alert> : null}
      </Stack>

      <Modal opened={pickerOpen} onClose={() => setPickerOpen(false)} title="Choose listing">
        <Radio.Group>
          <Stack gap="xs">
            {listings.map((listing) => (
              <Radio
                key={listing.remoteId}
                value={listing.remoteId}
                label={`${listing.callsign} — ${listing.name || listing.band} (${listing.status})`}
                onClick={() => {
                  setPickerOpen(false);
                  openDiffForListing(listing);
                }}
              />
            ))}
          </Stack>
        </Radio.Group>
      </Modal>

      <Modal
        opened={diffOpen}
        onClose={() => setDiffOpen(false)}
        title="Directory comparison"
        size="lg"
      >
        <Stack gap="md">
          {changedRows.length === 0 ? (
            <Text c="dimmed">This channel already matches the selected listing.</Text>
          ) : (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Apply</Table.Th>
                  <Table.Th>Field</Table.Th>
                  <Table.Th>Your channel</Table.Th>
                  <Table.Th>Directory</Table.Th>
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
            <Button variant="default" onClick={() => setDiffOpen(false)}>
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
      </Modal>
    </PageSection>
  );
}
