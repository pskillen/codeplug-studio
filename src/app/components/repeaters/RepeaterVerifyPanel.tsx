import { useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Group, Modal, Radio, Stack } from '@mantine/core';
import type { Channel } from '@core/models/library.ts';
import {
  matchListingForChannel,
  RepeaterDirectoryError,
  searchBrandmeisterByCallsign,
  searchUkRepeatersByCallsign,
  type MapListingOptions,
  type RepeaterListing,
} from '@integrations/repeaters/index.ts';
import { PageSection } from '../ui/index.ts';
import RepeaterListingUpdateDialog from './RepeaterListingUpdateDialog.tsx';

export interface RepeaterVerifyPanelProps {
  channel: Channel;
}

function channelHasDmr(channel: Channel): boolean {
  return channel.modeProfiles.some((p) => p.mode === 'dmr');
}

interface VerifySourceButtonProps {
  label: string;
  loading: boolean;
  onCheck: () => void;
}

function VerifySourceButton({ label, loading, onCheck }: VerifySourceButtonProps) {
  return (
    <Button variant="light" loading={loading} onClick={() => void onCheck()}>
      Check {label}
    </Button>
  );
}

export default function RepeaterVerifyPanel({ channel }: RepeaterVerifyPanelProps) {
  const [ukLoading, setUkLoading] = useState(false);
  const [bmLoading, setBmLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listings, setListings] = useState<RepeaterListing[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [updateListing, setUpdateListing] = useState<RepeaterListing | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [titleCaseNames, setTitleCaseNames] = useState(true);

  const showBrandmeister = channelHasDmr(channel);
  const ukMapOptions: MapListingOptions = useMemo(
    () => ({ titleCaseText: titleCaseNames }),
    [titleCaseNames],
  );
  const bmMapOptions: MapListingOptions = useMemo(() => ({ omitComment: true }), []);

  function openUpdateForListing(listing: RepeaterListing) {
    setUpdateListing(listing);
    setUpdateOpen(true);
  }

  async function runCheck(
    source: 'ukrepeater' | 'brandmeister',
    setLoading: (value: boolean) => void,
  ) {
    if (!channel.callsign.trim()) {
      setError('Enter a callsign on this channel before checking the directory.');
      return;
    }
    setLoading(true);
    setError(null);
    const sourceLabel = source === 'ukrepeater' ? 'ukrepeater.net' : 'BrandMeister';
    try {
      const results =
        source === 'brandmeister'
          ? await searchBrandmeisterByCallsign(channel.callsign)
          : await searchUkRepeatersByCallsign(channel.callsign);
      if (results.length === 0) {
        setError(`No listings found for ${channel.callsign} on ${sourceLabel}.`);
        return;
      }
      const auto = matchListingForChannel(channel, results);
      if (auto) {
        openUpdateForListing(auto);
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

  const activeMapOptions = updateListing?.source === 'brandmeister' ? bmMapOptions : ukMapOptions;

  return (
    <PageSection
      title="Check against directory"
      description="Compare this channel with public repeater directories and apply selected field updates."
    >
      <Stack gap="sm">
        <Group align="flex-end" wrap="wrap">
          <VerifySourceButton
            label="ukrepeater.net"
            loading={ukLoading}
            onCheck={() => void runCheck('ukrepeater', setUkLoading)}
          />
          {showBrandmeister ? (
            <VerifySourceButton
              label="BrandMeister"
              loading={bmLoading}
              onCheck={() => void runCheck('brandmeister', setBmLoading)}
            />
          ) : null}
          <Checkbox
            label="Title case names"
            checked={titleCaseNames}
            onChange={(e) => setTitleCaseNames(e.currentTarget.checked)}
          />
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
        mapOptions={activeMapOptions}
        opened={updateOpen}
        onClose={() => setUpdateOpen(false)}
      />
    </PageSection>
  );
}
