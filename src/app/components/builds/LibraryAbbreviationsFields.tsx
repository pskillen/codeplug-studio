import { Stack, Switch } from '@mantine/core';
import ExportSettingsSubheading from './ExportSettingsSubheading.tsx';

export interface LibraryAbbreviationsFieldsProps {
  shortenNames: boolean;
  useChannelAbbreviation: boolean;
  useTalkGroupAbbreviation: boolean;
  onChangeChannel: (value: boolean) => void;
  onChangeTalkGroup: (value: boolean) => void;
  disabled?: boolean;
  /** Show the channel-kind switch. Default true. */
  showChannel?: boolean;
  /** Show the talk-group-kind switch. Default true. */
  showTalkGroup?: boolean;
}

/**
 * One labelled group for both abbreviation-preference stored fields
 * (`useChannelAbbreviation`, `useTalkGroupAbbreviation`). Per-kind switches stay
 * separate fields — this only unifies where they are presented, not storage.
 */
export default function LibraryAbbreviationsFields({
  shortenNames,
  useChannelAbbreviation,
  useTalkGroupAbbreviation,
  onChangeChannel,
  onChangeTalkGroup,
  disabled,
  showChannel = true,
  showTalkGroup = true,
}: LibraryAbbreviationsFieldsProps) {
  if (!showChannel && !showTalkGroup) return null;
  const isDisabled = disabled ?? !shortenNames;
  const showBothKinds = showChannel && showTalkGroup;

  return (
    <Stack gap="xs">
      {showBothKinds ? (
        <ExportSettingsSubheading>Use abbreviations from library</ExportSettingsSubheading>
      ) : null}
      {showChannel ? (
        <Switch
          label={showBothKinds ? 'Channel abbreviations' : 'Use abbreviations from library'}
          description="Prefer each channel's abbreviation field before dictionary rules."
          checked={useChannelAbbreviation}
          disabled={isDisabled}
          onChange={(event) => onChangeChannel(event.currentTarget.checked)}
        />
      ) : null}
      {showTalkGroup ? (
        <Switch
          label={showBothKinds ? 'Talk group abbreviations' : 'Use abbreviations from library'}
          description="Prefer each talk group's abbreviation field before dictionary rules."
          checked={useTalkGroupAbbreviation}
          disabled={isDisabled}
          onChange={(event) => onChangeTalkGroup(event.currentTarget.checked)}
        />
      ) : null}
    </Stack>
  );
}
