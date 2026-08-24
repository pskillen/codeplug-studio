import { useState } from 'react';
import { Alert, Button, Stack, Text } from '@mantine/core';
import type { Channel, Library } from '@core/models/library.ts';
import type { RepeaterListing } from '@integrations/repeaters/index.ts';
import RepeaterListingPickerModal from './RepeaterListingPickerModal.tsx';
import BrandmeisterRxGroupListSyncDialog from './BrandmeisterRxGroupListSyncDialog.tsx';
import { useRepeaterListingLookup } from './useRepeaterListingLookup.ts';
import classes from './BrandmeisterRxListSyncAction.module.css';

export interface BrandmeisterRxListSyncActionProps {
  channel: Channel;
  library: Library;
}

export default function BrandmeisterRxListSyncAction({
  channel,
  library,
}: BrandmeisterRxListSyncActionProps) {
  const [bmTalkGroupsLoading, setBmTalkGroupsLoading] = useState(false);
  const [syncListing, setSyncListing] = useState<RepeaterListing | null>(null);
  const [rglSyncOpen, setRglSyncOpen] = useState(false);

  const hasCallsign = channel.callsign.trim().length > 0;

  const {
    error,
    listings,
    pickerIntent,
    pickerOpen,
    pickerTitle,
    setPickerOpen,
    runDirectoryCheck,
    chooseListing,
  } = useRepeaterListingLookup(channel, (listing) => {
    setSyncListing(listing);
    setRglSyncOpen(true);
  });

  return (
    <Stack gap="xs" className={classes.root}>
      <Text size="sm" c="dimmed">
        Compare static talk groups on the repeater and sync this channel&apos;s RX group list.
      </Text>
      <Button
        variant="light"
        size="sm"
        loading={bmTalkGroupsLoading}
        disabled={!hasCallsign}
        onClick={() => void runDirectoryCheck('brandmeister', 'talkGroups', setBmTalkGroupsLoading)}
      >
        Check BrandMeister talk groups &amp; RX list
      </Button>
      {!hasCallsign ? (
        <Text size="sm" c="dimmed">
          Enter a callsign in Identity to check BrandMeister talk groups.
        </Text>
      ) : null}
      {error ? <Alert color="red">{error}</Alert> : null}

      <RepeaterListingPickerModal
        listings={listings}
        intent={pickerIntent}
        opened={pickerOpen}
        title={pickerTitle}
        onClose={() => setPickerOpen(false)}
        onChoose={chooseListing}
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
    </Stack>
  );
}
