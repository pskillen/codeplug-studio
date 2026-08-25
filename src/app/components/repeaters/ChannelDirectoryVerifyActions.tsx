import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Anchor, Button, Checkbox, Text } from '@mantine/core';
import type { Channel } from '@core/models/library.ts';
import type { MapListingOptions, RepeaterListing } from '@integrations/repeaters/index.ts';
import { SETTINGS_REPEATERBOOK_SECTION_ID } from '../../lib/settingsSections.ts';
import { useRepeaterBookSettings } from '../../hooks/useRepeaterBookSettings.ts';
import RepeaterListingPickerModal from './RepeaterListingPickerModal.tsx';
import RepeaterListingUpdateDialog, {
  type RepeaterListingUpdateDialogMode,
} from './RepeaterListingUpdateDialog.tsx';
import { useRepeaterListingLookup } from './useRepeaterListingLookup.ts';
import classes from './ChannelDirectoryVerifyActions.module.css';

export interface ChannelDirectoryVerifyActionsProps {
  channel: Channel;
  /** Primary button — "Apply & save". Omit to hide the button. */
  onApplyAndSave?: (patched: Channel) => void;
  /** Secondary button — "Apply only". Fills the caller's form state; writes nothing. */
  onApplyAndContinue: (patched: Channel) => void;
  /** Copy variant — 'verify' (default, saved channel) vs 'lookup' (New channel). */
  mode?: RepeaterListingUpdateDialogMode;
}

function channelHasDmr(channel: Channel): boolean {
  return channel.modeProfiles.some((p) => p.mode === 'dmr');
}

const BUTTON_LABELS: Record<RepeaterListingUpdateDialogMode, Record<string, string>> = {
  verify: {
    ukrepeater: 'Check ukrepeater.net',
    irts: 'Check IRTS',
    repeaterbook: 'Check RepeaterBook',
    brandmeister: 'Check BrandMeister repeater',
  },
  lookup: {
    ukrepeater: 'Look up on ukrepeater.net',
    irts: 'Look up on IRTS',
    repeaterbook: 'Look up on RepeaterBook',
    brandmeister: 'Look up on BrandMeister',
  },
};

export default function ChannelDirectoryVerifyActions({
  channel,
  onApplyAndSave,
  onApplyAndContinue,
  mode = 'verify',
}: ChannelDirectoryVerifyActionsProps) {
  const [ukLoading, setUkLoading] = useState(false);
  const [irtsLoading, setIrtsLoading] = useState(false);
  const [rbLoading, setRbLoading] = useState(false);
  const [bmRepeaterLoading, setBmRepeaterLoading] = useState(false);
  const [updateListing, setUpdateListing] = useState<RepeaterListing | null>(null);
  const [updateOpen, setUpdateOpen] = useState(false);
  const [titleCaseNames, setTitleCaseNames] = useState(true);
  const { hasToken: hasRepeaterBookToken } = useRepeaterBookSettings();

  const showBrandmeister = channelHasDmr(channel);
  const hasCallsign = channel.callsign.trim().length > 0;

  const ukMapOptions: MapListingOptions = useMemo(
    () => ({ titleCaseText: titleCaseNames }),
    [titleCaseNames],
  );
  const bmMapOptions: MapListingOptions = useMemo(() => ({ omitComment: true }), []);

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
    setUpdateListing(listing);
    setUpdateOpen(true);
  });

  const activeMapOptions = updateListing?.source === 'brandmeister' ? bmMapOptions : ukMapOptions;

  return (
    <div className={classes.root}>
      <Text size="sm" c="dimmed">
        Compare frequencies, location, and other fields with public repeater directories.
      </Text>
      <div className={classes.actions}>
        <Button
          variant="light"
          size="sm"
          loading={ukLoading}
          disabled={!hasCallsign}
          onClick={() => void runDirectoryCheck('ukrepeater', 'repeater', setUkLoading)}
        >
          {BUTTON_LABELS[mode].ukrepeater}
        </Button>
        <Button
          variant="light"
          size="sm"
          loading={irtsLoading}
          disabled={!hasCallsign}
          onClick={() => void runDirectoryCheck('irts', 'repeater', setIrtsLoading)}
        >
          {BUTTON_LABELS[mode].irts}
        </Button>
        <Button
          variant="light"
          size="sm"
          loading={rbLoading}
          disabled={!hasCallsign || !hasRepeaterBookToken}
          onClick={() => void runDirectoryCheck('repeaterbook', 'repeater', setRbLoading)}
        >
          {BUTTON_LABELS[mode].repeaterbook}
        </Button>
        {showBrandmeister ? (
          <Button
            variant="light"
            size="sm"
            loading={bmRepeaterLoading}
            disabled={!hasCallsign}
            onClick={() => void runDirectoryCheck('brandmeister', 'repeater', setBmRepeaterLoading)}
          >
            {BUTTON_LABELS[mode].brandmeister}
          </Button>
        ) : null}
      </div>
      <Checkbox
        label="Title case names — ukrepeater.net and IRTS"
        size="sm"
        checked={titleCaseNames}
        onChange={(e) => setTitleCaseNames(e.currentTarget.checked)}
      />
      {!hasCallsign ? (
        <Text size="sm" c="dimmed">
          Enter a callsign to check against directories.
        </Text>
      ) : null}
      {!hasRepeaterBookToken ? (
        <Text size="sm" c="dimmed">
          RepeaterBook verify requires a token —{' '}
          <Anchor
            component={Link}
            to="/settings"
            state={{ scrollTo: SETTINGS_REPEATERBOOK_SECTION_ID }}
          >
            add in Settings
          </Anchor>
          .
        </Text>
      ) : null}
      {error ? (
        <Alert color="red" className={classes.error}>
          {error}
        </Alert>
      ) : null}

      <RepeaterListingPickerModal
        listings={listings}
        intent={pickerIntent}
        opened={pickerOpen}
        title={pickerTitle}
        onClose={() => setPickerOpen(false)}
        onChoose={chooseListing}
      />

      <RepeaterListingUpdateDialog
        channel={channel}
        listing={updateListing}
        mapOptions={activeMapOptions}
        opened={updateOpen}
        onClose={() => setUpdateOpen(false)}
        onApplyAndSave={onApplyAndSave}
        onApplyAndContinue={onApplyAndContinue}
        mode={mode}
      />
    </div>
  );
}
