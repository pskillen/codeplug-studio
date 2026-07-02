import { NumberInput, Select, Stack, Switch, Text } from '@mantine/core';
import {
  EXPORT_NAME_MODE_OPTIONS,
} from '@core/domain/channelNaming.ts';
import {
  EXPORT_NAME_MODE_RESPECT_PER_CHANNEL,
  useExportSettings,
  type ExportNameModeOverride,
} from '../../hooks/useExportSettings.ts';

export interface ExportNameSettingsFieldsProps {
  profileNameLimit?: number;
  /** RX-list fan-out formats only (e.g. DM32). Hidden on OpenGD77 lean export. */
  showMultiTalkGroupOptions?: boolean;
}

export default function ExportNameSettingsFields({
  profileNameLimit,
  showMultiTalkGroupOptions = false,
}: ExportNameSettingsFieldsProps) {
  const {
    shortenNames,
    setShortenNames,
    maxNameLength,
    setMaxNameLength,
    nameModeOverride,
    setNameModeOverride,
    useTalkGroupAbbreviation,
    setUseTalkGroupAbbreviation,
    useChannelAbbreviation,
    setUseChannelAbbreviation,
  } = useExportSettings();

  const nameModeData = [
    { value: EXPORT_NAME_MODE_RESPECT_PER_CHANNEL, label: 'Respect per-channel setting' },
    ...EXPORT_NAME_MODE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
  ];

  return (
    <Stack gap="sm">
      <Switch
        label="Shorten long channel names"
        description="Abbreviate names that exceed the target length at export time"
        checked={shortenNames}
        onChange={(e) => setShortenNames(e.currentTarget.checked)}
      />
      <NumberInput
        label="Target name length"
        description={
          profileNameLimit != null
            ? `Leave empty to use the radio profile default (${profileNameLimit} characters)`
            : 'Leave empty to use the radio profile default'
        }
        placeholder={profileNameLimit != null ? String(profileNameLimit) : 'Profile default'}
        min={1}
        max={64}
        value={maxNameLength ?? ''}
        onChange={(value) => {
          if (value === '' || value == null) {
            setMaxNameLength(null);
            return;
          }
          const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
          setMaxNameLength(Number.isFinite(n) && n > 0 ? n : null);
        }}
        disabled={!shortenNames}
      />
      <Select
        label="Export name mode override"
        description="Force all channels to one name style for this export (optional)"
        data={nameModeData}
        value={nameModeOverride}
        onChange={(value) => {
          if (value == null) return;
          setNameModeOverride(value as ExportNameModeOverride);
        }}
        allowDeselect={false}
        disabled={!shortenNames}
      />
      {showMultiTalkGroupOptions ? (
        <Switch
          label="Use talk group abbreviations"
          description="Prefer TalkGroup.abbreviation for multi-talkgroup channel suffixes"
          checked={useTalkGroupAbbreviation}
          onChange={(e) => setUseTalkGroupAbbreviation(e.currentTarget.checked)}
          disabled={!shortenNames}
        />
      ) : null}
      <Switch
        label="Use channel abbreviations"
        description="Prefer Channel.abbreviation for the name qualifier in export wire names"
        checked={useChannelAbbreviation}
        onChange={(e) => setUseChannelAbbreviation(e.currentTarget.checked)}
        disabled={!shortenNames}
      />
      <Text size="xs" c="dimmed">
        Preferences are saved in browser localStorage.
      </Text>
    </Stack>
  );
}
