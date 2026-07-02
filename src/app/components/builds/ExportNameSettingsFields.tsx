import { NumberInput, Stack, Switch, Text } from '@mantine/core';
import { useExportSettings } from '../../hooks/useExportSettings.ts';
import ExportNameModeSelect from './ExportNameModeSelect.tsx';

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
    useTalkGroupAbbreviation,
    setUseTalkGroupAbbreviation,
    useChannelAbbreviation,
    setUseChannelAbbreviation,
  } = useExportSettings();

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
      <ExportNameModeSelect
        disabled={!shortenNames}
        description="Fallback when shortening applies and a channel has no wire name override on this build."
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
