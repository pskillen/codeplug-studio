import { NumberInput, Stack, Switch } from '@mantine/core';
import { useCallback } from 'react';
import type { BuildExportSettings, FormatBuild } from '@core/models/formatBuild.ts';
import type { ChannelExportNameMode } from '@core/domain/channelNaming.ts';
import { radioTargetHasCompatibleFormat } from '@core/radio-targets/index.ts';
import { useDebouncedOptionalNumberField } from '../../hooks/useDebouncedOptionalNumberField.ts';
import { resolvedBuildExportSettings } from '../../lib/buildExportSettingsUi.ts';
import ExportNameModeSelect from './ExportNameModeSelect.tsx';
import DigitalContactExportNameModeSelect from './DigitalContactExportNameModeSelect.tsx';
import LibraryAbbreviationsFields from './LibraryAbbreviationsFields.tsx';
import ExportSettingsSubheading from './ExportSettingsSubheading.tsx';

export interface ExportNameSettingsFieldsProps {
  build: FormatBuild;
  onPatch: (patch: Partial<BuildExportSettings>) => void;
  saving?: boolean;
  profileNameLimit?: number;
}

/**
 * Naming section content — name style, library abbreviations, shorten/length, and
 * (where applicable) contact naming. Shared by every target; fields that don't apply
 * to a target's traits are gated by the caller, not forked per format.
 */
export default function ExportNameSettingsFields({
  build,
  onPatch,
  saving = false,
  profileNameLimit,
}: ExportNameSettingsFieldsProps) {
  const settings = resolvedBuildExportSettings(build);
  const showContactExportNameMode =
    radioTargetHasCompatibleFormat(build.radioTargetId, 'anytone') ||
    radioTargetHasCompatibleFormat(build.radioTargetId, 'opengd77');

  const commitMaxNameLength = useCallback(
    (value: number | undefined) => {
      onPatch({ maxNameLength: value ?? null });
    },
    [onPatch],
  );
  const maxNameLengthField = useDebouncedOptionalNumberField(
    settings.maxNameLength ?? undefined,
    commitMaxNameLength,
  );

  return (
    <Stack gap="sm">
      <ExportSettingsSubheading>Name style</ExportSettingsSubheading>
      <ExportNameModeSelect
        value={settings.nameModeOverride}
        disabled={saving}
        onChange={(nameModeOverride) => onPatch({ nameModeOverride })}
        description="Fallback when a channel has no wire name override on this build. Set overrides on the Channels wire page."
      />
      {showContactExportNameMode ? (
        <DigitalContactExportNameModeSelect
          value={settings.digitalContactExportNameMode}
          disabled={saving}
          onChange={(digitalContactExportNameMode) => onPatch({ digitalContactExportNameMode })}
        />
      ) : null}

      <ExportSettingsSubheading>Shorten and length</ExportSettingsSubheading>
      <Switch
        label="Shorten long names"
        description="Abbreviate names that exceed the target length at export."
        checked={settings.shortenNames}
        disabled={saving}
        onChange={(event) => onPatch({ shortenNames: event.currentTarget.checked })}
      />
      <NumberInput
        label="Target name length"
        description={
          profileNameLimit != null
            ? `This radio allows ${profileNameLimit} characters. Leave empty to use that default.`
            : 'Leave empty to use the radio profile default.'
        }
        placeholder={profileNameLimit != null ? String(profileNameLimit) : 'Profile default'}
        min={1}
        max={64}
        value={maxNameLengthField.value}
        disabled={saving || !settings.shortenNames}
        onChange={maxNameLengthField.setValue}
        onBlur={maxNameLengthField.flush}
      />

      <LibraryAbbreviationsFields
        shortenNames={settings.shortenNames}
        useChannelAbbreviation={settings.useChannelAbbreviation}
        useTalkGroupAbbreviation={settings.useTalkGroupAbbreviation}
        disabled={saving || !settings.shortenNames}
        onChangeChannel={(useChannelAbbreviation) => onPatch({ useChannelAbbreviation })}
        onChangeTalkGroup={(useTalkGroupAbbreviation) => onPatch({ useTalkGroupAbbreviation })}
      />
    </Stack>
  );
}

export type { ChannelExportNameMode };
