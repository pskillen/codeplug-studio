import { Stack, Switch, Text } from '@mantine/core';
import type {
  BuildExportSettings,
  DefaultScanInclusion,
  FormatBuild,
} from '@core/models/formatBuild.ts';
import { showsDefaultScanInclusion, hasMxNChannelExpansion } from '@core/models/traits.ts';
import type { FormatExportDefaults } from '@core/import-export/types.ts';
import { FieldCard } from '../fields/Fields.tsx';
import ExportNameSettingsFields from './ExportNameSettingsFields.tsx';
import ExportAnytoneSettingsSections from './ExportAnytoneSettingsSections.tsx';
import DefaultScanInclusionSegment from './DefaultScanInclusionSegment.tsx';
import ChannelBehaviourExportOverrides from './ChannelBehaviourExportOverrides.tsx';
import ZoneBehaviourExportOverrides from './ZoneBehaviourExportOverrides.tsx';
import type { ResolvedBuildExportSettings } from '../../lib/buildExportSettingsUi.ts';
import { TRAIT_LABELS } from '../../routes/builds/buildHelpers.ts';

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
    field:
      | 'exportUnlinkedChannels'
      | 'exportUnlinkedTalkGroups'
      | 'exportUnlinkedRxGroupLists'
      | 'exportUnlinkedDigitalContacts'
      | 'exportUnlinkedAnalogContacts',
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
  if (build.formatId === 'anytone') {
    return (
      <ExportAnytoneSettingsSections
        build={build}
        saving={saving}
        settingsError={settingsError}
        profileNameLimit={profileNameLimit}
        resolvedSettings={resolvedSettings}
        onExportSettingsPatch={onExportSettingsPatch}
        onExportInclusionChange={onExportInclusionChange}
      />
    );
  }

  const isChirp = build.formatId === 'chirp';
  const showChannelExpansion = hasMxNChannelExpansion(build.profileId);

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
            <Switch
              label="Export digital contacts not referenced by a channel"
              checked={build.exportUnlinkedDigitalContacts !== false}
              disabled={saving}
              onChange={(event) =>
                onExportInclusionChange(
                  'exportUnlinkedDigitalContacts',
                  event.currentTarget.checked,
                )
              }
            />
            <Switch
              label="Export analog contacts not referenced by a channel"
              checked={build.exportUnlinkedAnalogContacts !== false}
              disabled={saving}
              onChange={(event) =>
                onExportInclusionChange('exportUnlinkedAnalogContacts', event.currentTarget.checked)
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

      {showChannelExpansion ? (
        <FieldCard
          title="Channel expansion"
          description="Export-time projections for digital channels with RX group lists."
        >
          <Switch
            label={TRAIT_LABELS.mxnChannelExpansion}
            description="Emit one export channel memory per talk group on each repeater channel's RX group list."
            checked={resolvedSettings.expandRxGroupLists}
            disabled={saving}
            onChange={(event) =>
              onExportSettingsPatch({
                expandRxGroupLists: event.currentTarget.checked,
                ...(event.currentTarget.checked ? {} : { exportScratchChannels: false }),
              })
            }
          />
          <Switch
            label="Scratch channels"
            description="Add one editable parent memory per expanded repeater (name includes Scratch)."
            checked={resolvedSettings.exportScratchChannels}
            disabled={saving || !resolvedSettings.expandRxGroupLists}
            onChange={(event) =>
              onExportSettingsPatch({ exportScratchChannels: event.currentTarget.checked })
            }
          />
        </FieldCard>
      ) : null}

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
        {(build.formatId === 'dm32' || build.formatId === 'anytone') && (
          <>
            <Switch
              label={
                build.formatId === 'dm32'
                  ? 'Export zone-derived scan lists (Scan.csv)'
                  : 'Export zone-derived scan lists (ScanList.CSV)'
              }
              description="Requires per-zone Export as scan list on the Zones page. Library scan lists still export when enabled."
              checked={resolvedSettings.exportZoneDerivedScanLists}
              disabled={saving}
              onChange={(event) =>
                onExportSettingsPatch({
                  exportZoneDerivedScanLists: event.currentTarget.checked,
                })
              }
            />
            <ZoneBehaviourExportOverrides
              exportSettings={build.exportSettings}
              disabled={saving}
              onPatch={onExportSettingsPatch}
            />
          </>
        )}
      </FieldCard>

      <FieldCard
        title="Channel behaviour"
        description="Optional build overrides for library behavioural defaults. When set, these win over library defaults and per-channel overrides at export."
      >
        <ChannelBehaviourExportOverrides
          exportSettings={build.exportSettings}
          disabled={saving}
          onPatch={onExportSettingsPatch}
        />
      </FieldCard>
    </Stack>
  );
}
