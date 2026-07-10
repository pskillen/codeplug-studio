import { useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Group, Modal, Radio, Stack, Text } from '@mantine/core';
import type { Channel, Library } from '@core/models/library.ts';
import {
  matchListingForChannel,
  RepeaterDirectoryError,
  searchBrandmeisterByCallsign,
  searchIrtsByCallsign,
  searchUkRepeatersByCallsign,
  type MapListingOptions,
  type RepeaterListing,
  type RepeaterSource,
} from '@integrations/repeaters/index.ts';
import { PageSection } from '../ui/index.ts';
import BrandmeisterRxGroupListSyncDialog from './BrandmeisterRxGroupListSyncDialog.tsx';
import RepeaterListingUpdateDialog from './RepeaterListingUpdateDialog.tsx';

export interface RepeaterVerifyPanelProps {
  channel: Channel;
  library: Library;
}

type VerifyIntent = 'repeater' | 'talkGroups';

type VerifySource = Extract<RepeaterSource, 'ukrepeater' | 'brandmeister' | 'irts'>;

const VERIFY_SOURCE_LABEL: Record<VerifySource, string> = {
  ukrepeater: 'ukrepeater.net',
  brandmeister: 'BrandMeister',
  irts: 'IRTS',
};

function channelHasDmr(channel: Channel): boolean {
  return channel.modeProfiles.some((p) => p.mode === 'dmr');
}

export default function RepeaterVerifyPanel({ channel, library }: RepeaterVerifyPanelProps) {
  const [ukLoading, setUkLoading] = useState(false);
  const [irtsLoading, setIrtsLoading] = useState(false);
  const [bmRepeaterLoading, setBmRepeaterLoading] = useState(false);
  const [bmTalkGroupsLoading, setBmTalkGroupsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listings, setListings] = useState<RepeaterListing[]>([]);
  const [pickerIntent, setPickerIntent] = useState<VerifyIntent>('repeater');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [updateListing, setUpdateListing] = useState<RepeaterListing | null>(null);
  const [syncListing, setSyncListing] = useState<RepeaterListing | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [rglSyncOpen, setRglSyncOpen] = useState(false);
  const [titleCaseNames, setTitleCaseNames] = useState(true);

  const showBrandmeister = channelHasDmr(channel);
  const ukMapOptions: MapListingOptions = useMemo(
    () => ({ titleCaseText: titleCaseNames }),
    [titleCaseNames],
  );
  const bmMapOptions: MapListingOptions = useMemo(() => ({ omitComment: true }), []);

  function openRepeaterUpdate(listing: RepeaterListing) {
    setUpdateListing(listing);
    setUpdateOpen(true);
  }

  function openTalkGroupSync(listing: RepeaterListing) {
    setSyncListing(listing);
    setRglSyncOpen(true);
  }

  function chooseListing(listing: RepeaterListing, intent: VerifyIntent) {
    if (intent === 'repeater') {
      openRepeaterUpdate(listing);
      return;
    }
    openTalkGroupSync(listing);
  }

  async function runDirectoryCheck(
    source: VerifySource,
    intent: VerifyIntent,
    setLoading: (value: boolean) => void,
  ) {
    if (!channel.callsign.trim()) {
      setError('Enter a callsign on this channel before checking the directory.');
      return;
    }
    setLoading(true);
    setError(null);
    const sourceLabel = VERIFY_SOURCE_LABEL[source];
    try {
      const results =
        source === 'brandmeister'
          ? await searchBrandmeisterByCallsign(channel.callsign)
          : source === 'irts'
            ? await searchIrtsByCallsign(channel.callsign)
            : await searchUkRepeatersByCallsign(channel.callsign);
      if (results.length === 0) {
        setError(`No listings found for ${channel.callsign} on ${sourceLabel}.`);
        return;
      }
      const auto = matchListingForChannel(channel, results);
      if (auto) {
        chooseListing(auto, intent);
        return;
      }
      if (results.length === 1) {
        chooseListing(results[0]!, intent);
        return;
      }
      setListings(results);
      setPickerIntent(intent);
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
  const pickerTitle =
    pickerIntent === 'repeater' ? 'Choose repeater listing' : 'Choose repeater for talk groups';

  return (
    <PageSection
      title="Check against directory"
      description="Compare this channel with public repeater directories and apply selected updates."
    >
      <Stack gap="lg">
        <Stack gap="xs">
          <Text component="h3" size="sm" fw={600}>
            Repeater details
          </Text>
          <Text size="sm" c="dimmed">
            Frequencies, colour code, location, and other channel fields from the directory listing.
          </Text>
          <Group align="flex-end" wrap="wrap">
            <Button
              variant="light"
              loading={ukLoading}
              onClick={() => void runDirectoryCheck('ukrepeater', 'repeater', setUkLoading)}
            >
              Check ukrepeater.net
            </Button>
            <Button
              variant="light"
              loading={irtsLoading}
              onClick={() => void runDirectoryCheck('irts', 'repeater', setIrtsLoading)}
            >
              Check IRTS
            </Button>
            {showBrandmeister ? (
              <Button
                variant="light"
                loading={bmRepeaterLoading}
                onClick={() =>
                  void runDirectoryCheck('brandmeister', 'repeater', setBmRepeaterLoading)
                }
              >
                Check BrandMeister repeater
              </Button>
            ) : null}
            <Checkbox
              label="Title case names"
              checked={titleCaseNames}
              onChange={(e) => setTitleCaseNames(e.currentTarget.checked)}
            />
          </Group>
        </Stack>

        {showBrandmeister ? (
          <Stack gap="xs">
            <Text component="h3" size="sm" fw={600}>
              BrandMeister talk groups
            </Text>
            <Text size="sm" c="dimmed">
              Compare static talk groups on the repeater and sync this channel&apos;s RX group list.
              This does not change frequencies or other repeater details.
            </Text>
            <Button
              variant="light"
              fullWidth
              loading={bmTalkGroupsLoading}
              onClick={() =>
                void runDirectoryCheck('brandmeister', 'talkGroups', setBmTalkGroupsLoading)
              }
            >
              Check BrandMeister talk groups &amp; RX list
            </Button>
          </Stack>
        ) : null}

        {error ? <Alert color="red">{error}</Alert> : null}
      </Stack>

      <Modal opened={pickerOpen} onClose={() => setPickerOpen(false)} title={pickerTitle}>
        <Radio.Group>
          <Stack gap="xs">
            {listings.map((listing) => (
              <Radio
                key={listing.remoteId}
                value={listing.remoteId}
                label={`${listing.callsign} — ${listing.name || listing.band} (${listing.status})`}
                onClick={() => {
                  setPickerOpen(false);
                  chooseListing(listing, pickerIntent);
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

      {syncListing ? (
        <BrandmeisterRxGroupListSyncDialog
          channel={channel}
          library={library}
          listing={syncListing}
          opened={rglSyncOpen}
          onClose={() => setRglSyncOpen(false)}
        />
      ) : null}
    </PageSection>
  );
}
