import { useState } from 'react';
import { Alert, Button, Group, Modal, Radio, Stack } from '@mantine/core';
import type { Channel } from '@core/models/library.ts';
import {
  RepeaterDirectoryError,
  searchBrandmeisterByCallsign,
  searchUkRepeatersByCallsign,
  type RepeaterListing,
} from '@integrations/repeaters/index.ts';
import { PageSection } from '../ui/index.ts';
import RepeaterListingUpdateDialog from './RepeaterListingUpdateDialog.tsx';

export interface RepeaterVerifyPanelProps {
  channel: Channel;
}

function sourceForChannel(channel: Channel): 'ukrepeater' | 'brandmeister' {
  return channel.modeProfiles.some((p) => p.mode === 'dmr') ? 'brandmeister' : 'ukrepeater';
}

export default function RepeaterVerifyPanel({ channel }: RepeaterVerifyPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listings, setListings] = useState<RepeaterListing[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [updateListing, setUpdateListing] = useState<RepeaterListing | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);

  const source = sourceForChannel(channel);
  const sourceLabel = source === 'ukrepeater' ? 'ukrepeater.net' : 'BrandMeister';

  function openUpdateForListing(listing: RepeaterListing) {
    setUpdateListing(listing);
    setUpdateOpen(true);
  }

  async function handleCheck() {
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
        openUpdateForListing(results[0]!);
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
  }

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
                  openUpdateForListing(listing);
                }}
              />
            ))}
          </Stack>
        </Radio.Group>
      </Modal>

      <RepeaterListingUpdateDialog
        channel={channel}
        listing={updateListing}
        opened={updateOpen}
        onClose={() => setUpdateOpen(false)}
      />
    </PageSection>
  );
}
