import { NumberInput, Stack, Switch, Text } from '@mantine/core';
import type { BuildExportSettings, FormatBuild } from '@core/models/formatBuild.ts';
import type { ChannelExportNameMode } from '@core/domain/channelNaming.ts';
import { resolvedBuildExportSettings } from '../../lib/buildExportSettingsUi.ts';
import ExportNameModeSelect from './ExportNameModeSelect.tsx';
import DigitalContactExportNameModeSelect from './DigitalContactExportNameModeSelect.tsx';
import UseLibraryAbbreviationsSwitch from './UseLibraryAbbreviationsSwitch.tsx';

export interface ExportNameSettingsFieldsProps {
  build: FormatBuild;
  formatId: string;
  onPatch: (patch: Partial<BuildExportSettings>) => void;
  saving?: boolean;
  profileNameLimit?: number;
}

export default function ExportNameSettingsFields({
  build,
  formatId,
  onPatch,
  saving = false,
  profileNameLimit,
}: ExportNameSettingsFieldsProps) {
  const settings = resolvedBuildExportSettings(build, formatId);
  const showContactExportNameMode = formatId === 'anytone' || formatId === 'opengd77';

  return (
    <Stack gap="sm">
      <Switch
        label="Shorten long names"
        description="Abbreviate names that exceed the target length at export"
        checked={settings.shortenNames}
        disabled={saving}
        onChange={(e) => onPatch({ shortenNames: e.currentTarget.checked })}
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
        value={settings.maxNameLength ?? ''}
        disabled={saving || !settings.shortenNames}
        onChange={(value) => {
          if (value === '' || value == null) {
            onPatch({ maxNameLength: null });
            return;
          }
          const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
          onPatch({ maxNameLength: Number.isFinite(n) && n > 0 ? n : null });
        }}
      />
      <ExportNameModeSelect
        value={settings.nameModeOverride}
        disabled={saving || !settings.shortenNames}
        onChange={(nameModeOverride) => onPatch({ nameModeOverride })}
        description="Fallback when shortening applies and a channel has no wire name override on this build."
      />
      <UseLibraryAbbreviationsSwitch
        shortenNames={settings.shortenNames}
        value={settings.useChannelAbbreviation && settings.useTalkGroupAbbreviation}
        disabled={saving}
        onChange={(useLibraryAbbreviations) =>
          onPatch({
            useChannelAbbreviation: useLibraryAbbreviations,
            useTalkGroupAbbreviation: useLibraryAbbreviations,
          })
        }
      />
      {showContactExportNameMode ? (
        <DigitalContactExportNameModeSelect
          value={settings.digitalContactExportNameMode}
          disabled={saving}
          onChange={(digitalContactExportNameMode) => onPatch({ digitalContactExportNameMode })}
        />
      ) : null}
      <Text size="xs" c="dimmed">
        Saved with this build and included in native YAML export.
      </Text>
    </Stack>
  );
}

export type { ChannelExportNameMode };
