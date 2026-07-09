import { Stack, Switch, Text } from '@mantine/core';
import type {
  BuildExportSettings,
  DefaultScanInclusion,
  FormatBuild,
} from '@core/models/formatBuild.ts';
import { showsDefaultScanInclusion } from '@core/models/traits.ts';
import type { FormatExportDefaults } from '@core/import-export/types.ts';
import { FieldCard } from '../fields/Fields.tsx';
import ExportNameSettingsFields from './ExportNameSettingsFields.tsx';
import DefaultScanInclusionSegment from './DefaultScanInclusionSegment.tsx';
import type { ResolvedBuildExportSettings } from '../../lib/buildExportSettingsUi.ts';

export interface ExportBuildSettingsSectionsProps {
  build: FormatBuild;
  saving: boolean;
  settingsError: string | null;
  profileNameLimit?: number;
  resolvedSettings: ResolvedBuildExportSettings;
  formatDefaults: FormatExportDefaults;
  defaultScanValue: DefaultScanInclusion;
  onExportSettingsPatch: (patch: Partial<BuildExportSettings>) => void;
  onExportInclusionChange: (
    field: 'exportUnlinkedChannels' | 'exportUnlinkedTalkGroups' | 'exportUnlinkedRxGroupLists',
    checked: boolean,
  ) => void;
}

export default function ExportBuildSettingsSections({
  build,
  saving,
  settingsError,
  profileNameLimit,
  resolvedSettings,
  formatDefaults,
  defaultScanValue,
  onExportSettingsPatch,
  onExportInclusionChange,
}: ExportBuildSettingsSectionsProps) {
  const isChirp = build.formatId === 'chirp';

  return (
    <Stack gap="md">
      <FieldCard
        title="Inclusion"
        description="Which library entities are emitted when they are not referenced by exported channels."
      >
        <Switch
          label={
            isChirp
              ? 'Export channels not in the memory list'
              : 'Export channels not linked to a zone'
          }
          checked={build.exportUnlinkedChannels !== false}
          disabled={saving}
          onChange={(event) =>
            onExportInclusionChange('exportUnlinkedChannels', event.currentTarget.checked)
          }
        />
        {!isChirp ? (
          <>
            <Switch
              label="Export talk groups not referenced by a channel"
              checked={build.exportUnlinkedTalkGroups !== false}
              disabled={saving}
              onChange={(event) =>
                onExportInclusionChange('exportUnlinkedTalkGroups', event.currentTarget.checked)
              }
            />
            <Switch
              label="Export RX group lists not referenced by a channel"
              checked={build.exportUnlinkedRxGroupLists !== false}
              disabled={saving}
              onChange={(event) =>
                onExportInclusionChange('exportUnlinkedRxGroupLists', event.currentTarget.checked)
              }
            />
          </>
        ) : null}
        {settingsError ? (
          <Text size="sm" c="red">
            {settingsError}
          </Text>
        ) : null}
      </FieldCard>

      <FieldCard
        title="Naming"
        description="Wire name length, abbreviation, and fallback style for CPS export."
      >
        <ExportNameSettingsFields
          build={build}
          saving={saving}
          onPatch={onExportSettingsPatch}
          profileNameLimit={profileNameLimit}
        />
      </FieldCard>

      <FieldCard
        title="Scanning"
        description={
          showsDefaultScanInclusion(build.profileId)
            ? 'Default scan behaviour for channels and format-specific scan list export.'
            : 'Scan list membership and per-channel assignment for this format.'
        }
      >
        {showsDefaultScanInclusion(build.profileId) ? (
          <DefaultScanInclusionSegment
            value={defaultScanValue}
            formatDefault={formatDefaults.defaultScanInclusion}
            disabled={saving}
            onChange={(defaultScanInclusion) => onExportSettingsPatch({ defaultScanInclusion })}
          />
        ) : (
          <Text size="sm" c="dimmed">
            Dedicated scan lists use library membership (Library → Scan lists) and per-channel
            assignment on the Channels page — not export defaults.
          </Text>
        )}
        {build.formatId === 'dm32' ? (
          <Switch
            label="Export zone-derived scan lists (Scan.csv)"
            description="Requires per-zone scan export enabled on the Zones page."
            checked={resolvedSettings.exportZoneDerivedScanLists}
            disabled={saving}
            onChange={(event) =>
              onExportSettingsPatch({
                exportZoneDerivedScanLists: event.currentTarget.checked,
              })
            }
          />
        ) : null}
      </FieldCard>
    </Stack>
  );
}
