import { SegmentedControl, Stack, Switch, Text } from '@mantine/core';
import type {
  BuildExportSettings,
  DefaultScanInclusion,
  FormatBuild,
} from '@core/models/formatBuild.ts';
import {
  hasMxNChannelExpansion,
  radioTargetHasCompatibleFormat,
  showsDefaultScanInclusion,
} from '@core/radio-targets/index.ts';
import { buildUsesFlatMemoryList } from '@core/domain/exportOrderOrSlot.ts';
import type { FormatExportDefaults } from '@core/import-export/types.ts';
import { FieldCard } from '../fields/Fields.tsx';
import ExportNameSettingsFields from './ExportNameSettingsFields.tsx';
import FrequencyRangeEligibilityFields from './FrequencyRangeEligibilityFields.tsx';
import DefaultScanInclusionSegment from './DefaultScanInclusionSegment.tsx';
import ChannelBehaviourExportOverrides from './ChannelBehaviourExportOverrides.tsx';
import ZoneBehaviourExportOverrides from './ZoneBehaviourExportOverrides.tsx';
import ExportDirectoryProjectionFields from './ExportDirectoryProjectionFields.tsx';
import AtD890ScanListTimingFields from './AtD890ScanListTimingFields.tsx';
import type { ResolvedBuildExportSettings } from '../../lib/buildExportSettingsUi.ts';
import { TRAIT_LABELS } from '../../routes/builds/buildHelpers.ts';
import {
  hasPersistedStepKeySwitch,
  isMm9pdyStepKeyTarget,
  mm9pdyStepKeysDescription,
} from './mm9pdyStepKeysCopy.ts';

export interface ExportBuildSettingsSectionsProps {
  build: FormatBuild;
  /** Active egress format — pathway copy only (e.g. naming card wording). */
  formatId: string;
  /** Active egress profile — directory projection trait gates. */
  profileId: string;
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

/**
 * One capability-gated section tree for every export/write target — Anytone included.
 * Section order follows the operator's mental sequence: what goes on the radio → how
 * it's named → how it's organised → how it behaves. Sections gate their own controls by
 * `build.radioTargetId` catalog traits, not by forking the whole tree per format.
 */
export default function ExportBuildSettingsSections({
  build,
  formatId,
  profileId,
  saving,
  settingsError,
  profileNameLimit,
  resolvedSettings,
  formatDefaults,
  defaultScanValue,
  onExportSettingsPatch,
  onExportInclusionChange,
}: ExportBuildSettingsSectionsProps) {
  const flatMemory = buildUsesFlatMemoryList(build);
  const showChannelExpansion = hasMxNChannelExpansion(build.radioTargetId);
  const showZoneDerivedScanLists =
    radioTargetHasCompatibleFormat(build.radioTargetId, 'dm32') ||
    radioTargetHasCompatibleFormat(build.radioTargetId, 'anytone');
  const showD890ScanListTiming = build.radioTargetId === 'anytone-at-d890uv';
  const showMm9pdyStepKeys = isMm9pdyStepKeyTarget(build.radioTargetId);
  const showRt95ZoneKey = build.radioTargetId === 'retevis-rt95-mm9pdy';
  const zoneKey = build.exportSettings?.rt95ZoneKey;
  const showStepKeySwitch = hasPersistedStepKeySwitch(build.radioTargetId);

  return (
    <Stack gap="md">
      <FrequencyRangeEligibilityFields
        hideOutsideFrequencyRange={
          build.exportSettings?.hideChannelsOutsideFrequencyRange !== false
        }
        saving={saving}
        onPatch={onExportSettingsPatch}
      />

      {!flatMemory ? (
        <FieldCard
          title="What gets exported"
          description="Which library entities are exported when they are not already linked from an exported channel or zone."
        >
          <Switch
            label="Include channels that aren't in a zone"
            description="When off, only channels that belong to a zone are exported. Your library is unchanged."
            checked={build.exportUnlinkedChannels !== false}
            disabled={saving}
            onChange={(event) =>
              onExportInclusionChange('exportUnlinkedChannels', event.currentTarget.checked)
            }
          />
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
              onExportInclusionChange('exportUnlinkedDigitalContacts', event.currentTarget.checked)
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
          {settingsError ? (
            <Text size="sm" c="red">
              {settingsError}
            </Text>
          ) : null}
        </FieldCard>
      ) : settingsError ? (
        <Text size="sm" c="red">
          {settingsError}
        </Text>
      ) : null}

      <FieldCard
        title="Naming"
        description={
          formatId === 'radio-io'
            ? 'Wire name length, abbreviation, and fallback style for radio write.'
            : 'Wire name length, abbreviation, and fallback style for CPS export.'
        }
      >
        <ExportNameSettingsFields
          build={build}
          saving={saving}
          onPatch={onExportSettingsPatch}
          profileNameLimit={profileNameLimit}
        />
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
        title="Organisation"
        description={
          showsDefaultScanInclusion(build.radioTargetId)
            ? 'Default scan behaviour for channels and format-specific scan list export.'
            : 'Scan list membership and per-channel assignment for this format.'
        }
      >
        {showsDefaultScanInclusion(build.radioTargetId) ? (
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
        {showZoneDerivedScanLists ? (
          <>
            <Switch
              label="Create scan lists from zones"
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
            {showD890ScanListTiming ? (
              <AtD890ScanListTimingFields
                exportSettings={build.exportSettings}
                onPatch={onExportSettingsPatch}
              />
            ) : null}
          </>
        ) : null}
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

      <ExportDirectoryProjectionFields
        build={build}
        formatId={formatId}
        profileId={profileId}
        saving={saving}
        onPatch={onExportSettingsPatch}
      />

      {showStepKeySwitch ? (
        <FieldCard
          title="MM9PDY key assignment"
          description="Optional. Off leaves the radio's programmable keys as they were read."
        >
          <Switch
            label="Assign TG previous and TG next"
            description={mm9pdyStepKeysDescription(build.radioTargetId)}
            checked={build.exportSettings?.assignMm9pdyStepKeys === true}
            disabled={saving}
            onChange={(event) =>
              onExportSettingsPatch({
                assignMm9pdyStepKeys: event.currentTarget.checked,
              })
            }
          />
        </FieldCard>
      ) : null}

      {showMm9pdyStepKeys ? (
        <FieldCard
          title="MM9PDY channel distance"
          description="Write stores each channel's position (Use location on) so the radio can show how far away the site is. Choose the unit the radio shows it in."
        >
          <Stack gap={4}>
            <Text size="sm" fw={500}>
              Distance unit
            </Text>
            <SegmentedControl
              size="sm"
              aria-label="Distance unit"
              data={[
                { value: 'km', label: 'Kilometres' },
                { value: 'mi', label: 'Miles' },
              ]}
              value={build.exportSettings?.channelDistanceUnit ?? 'km'}
              disabled={saving}
              onChange={(value) =>
                onExportSettingsPatch({ channelDistanceUnit: value === 'mi' ? 'mi' : 'km' })
              }
            />
          </Stack>
        </FieldCard>
      ) : null}

      {showRt95ZoneKey ? (
        <FieldCard
          title="Put Zone on a P-key"
          description="Sets the chosen key to the stock DIR function, which the MM9PDY firmware uses for Zone. The official CPS and CHIRP show this key as DIR. The radio shows ZON."
        >
          <Stack gap="xs">
            <Switch
              label="Put Zone on a P-key"
              checked={zoneKey !== undefined}
              disabled={saving}
              onChange={(event) =>
                onExportSettingsPatch({
                  rt95ZoneKey: event.currentTarget.checked ? { group: 1, key: 1 } : undefined,
                })
              }
            />
            {zoneKey ? (
              <>
                <SegmentedControl
                  size="sm"
                  aria-label="Zone key"
                  data={['P1', 'P2', 'P3', 'P4', 'P5', 'P6'].map((label, i) => ({
                    value: String(i + 1),
                    label,
                  }))}
                  value={String(zoneKey.key)}
                  disabled={saving}
                  onChange={(value) =>
                    onExportSettingsPatch({
                      rt95ZoneKey: { ...zoneKey, key: Number(value) as 1 | 2 | 3 | 4 | 5 | 6 },
                    })
                  }
                />
                <SegmentedControl
                  size="sm"
                  aria-label="Zone key FUNC group"
                  data={[
                    { value: '1', label: 'FUNC group 1' },
                    { value: '2', label: 'FUNC group 2' },
                  ]}
                  value={String(zoneKey.group)}
                  disabled={saving}
                  onChange={(value) =>
                    onExportSettingsPatch({
                      rt95ZoneKey: { ...zoneKey, group: value === '2' ? 2 : 1 },
                    })
                  }
                />
              </>
            ) : null}
          </Stack>
        </FieldCard>
      ) : null}

      <Text size="xs" c="dimmed">
        Export preferences are saved with this build and included in native YAML export.
      </Text>
    </Stack>
  );
}
