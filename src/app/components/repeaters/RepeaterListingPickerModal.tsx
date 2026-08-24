import { Modal, Radio, Stack } from '@mantine/core';
import type { RepeaterListing } from '@integrations/repeaters/index.ts';
import type { RepeaterVerifyIntent } from './useRepeaterListingLookup.ts';

export interface RepeaterListingPickerModalProps {
  listings: RepeaterListing[];
  intent: RepeaterVerifyIntent;
  opened: boolean;
  title: string;
  onClose: () => void;
  onChoose: (listing: RepeaterListing, intent: RepeaterVerifyIntent) => void;
}

export default function RepeaterListingPickerModal({
  listings,
  intent,
  opened,
  title,
  onClose,
  onChoose,
}: RepeaterListingPickerModalProps) {
  return (
    <Modal opened={opened} onClose={onClose} title={title}>
      <Radio.Group>
        <Stack gap="xs">
          {listings.map((listing) => (
            <Radio
              key={listing.remoteId}
              value={listing.remoteId}
              label={`${listing.callsign} — ${listing.name || listing.band} (${listing.status})`}
              onClick={() => {
                onClose();
                onChoose(listing, intent);
              }}
            />
          ))}
        </Stack>
      </Radio.Group>
    </Modal>
  );
}
