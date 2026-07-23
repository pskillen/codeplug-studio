import { NumberInput, Stack, Switch, Text } from '@mantine/core';
import { hasMxNChannelExpansion } from '@core/radio-targets/index.ts';
import { FieldCard } from '../fields/Fields.tsx';
import ExportNameModeSelect from './ExportNameModeSelect.tsx';
import DigitalContactExportNameModeSelect from './DigitalContactExportNameModeSelect.tsx';
import ExportSettingsSubheading from './ExportSettingsSubheading.tsx';
import ChannelBehaviourExportOverrides from './ChannelBehaviourExportOverrides.tsx';
import ZoneBehaviourExportOverrides from './ZoneBehaviourExportOverrides.tsx';
import { TRAIT_LABELS } from '../../routes/builds/buildHelpers.ts';
import type { ExportBuildSettingsSectionsProps } from './ExportBuildSettingsSections.tsx';

type ExportAnytoneSettingsSectionsProps = Pick<
  ExportBuildSettingsSectionsProps,
  | 'build'
  | 'saving'
  | 'settingsError'
  | 'profileNameLimit'
  | 'resolvedSettings'
  | 'onExportSettingsPatch'
  | 'onExportInclusionChange'
>;

export default function ExportAnytoneSettingsSections({
  build,
  saving,
  settingsError,
  profileNameLimit,
  resolvedSettings,
  onExportSettingsPatch,
  onExportInclusionChange,
}: ExportAnytoneSettingsSectionsProps) {
  const showChannelExpansion = hasMxNChannelExpansion(build.radioTargetId);

  return (
    <Stack gap="md">
      {settingsError ? (
        <Text size="sm" c="red">
          {settingsError}
        </Text>
      ) : null}

      <FieldCard
        title="Channels"
        description="Channel.CSV rows, wire names, and optional m×n expansion for repeater RX group lists."
      >
        <Switch
          label="Export channels not linked to a zone"
          checked={build.exportUnlinkedChannels !== false}
          disabled={saving}
          onChange={(event) =>
            onExportInclusionChange('exportUnlinkedChannels', event.currentTarget.checked)
          }
        />

        <ExportSettingsSubheading>Wire name limits</ExportSettingsSubheading>
        <Switch
          label="Shorten long names"
          description="Abbreviate CPS wire names that exceed the target length (channels, zones, lists, contacts)."
          checked={resolvedSettings.shortenNames}
          disabled={saving}
          onChange={(event) => onExportSettingsPatch({ shortenNames: event.currentTarget.checked })}
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
          value={resolvedSettings.maxNameLength ?? ''}
          disabled={saving || !resolvedSettings.shortenNames}
          onChange={(value) => {
            if (value === '' || value == null) {
              onExportSettingsPatch({ maxNameLength: null });
              return;
            }
            const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
            onExportSettingsPatch({
              maxNameLength: Number.isFinite(n) && n > 0 ? n : null,
            });
          }}
        />

        <ExportSettingsSubheading>Channel wire names</ExportSettingsSubheading>
        <ExportNameModeSelect
          value={resolvedSettings.nameModeOverride}
          disabled={saving || !resolvedSettings.shortenNames}
          onChange={(nameModeOverride) => onExportSettingsPatch({ nameModeOverride })}
          description="Fallback when shortening applies and a channel has no wire name override on this build."
        />
        <Switch
          label="Use channel abbreviations when shortening"
          description="Prefer each channel's abbreviation field before dictionary rules."
          checked={resolvedSettings.useChannelAbbreviation}
          disabled={saving || !resolvedSettings.shortenNames}
          onChange={(event) =>
            onExportSettingsPatch({ useChannelAbbreviation: event.currentTarget.checked })
          }
        />

        {showChannelExpansion ? (
          <>
            <ExportSettingsSubheading>m×n channel expansion</ExportSettingsSubheading>
            <Switch
              label={TRAIT_LABELS.mxnChannelExpansion}
              description="Emit one Channel.CSV memory per talk group on each repeater channel's RX group list."
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
          </>
        ) : null}
      </FieldCard>

      <FieldCard
        title="Channel behaviour"
        description="Optional build overrides for library behavioural defaults. When set, these win at export."
      >
        <ChannelBehaviourExportOverrides
          exportSettings={build.exportSettings}
          disabled={saving}
          onPatch={onExportSettingsPatch}
        />
      </FieldCard>

      <FieldCard
        title="Zones"
        description="DMRZone.CSV membership and zone wire names — curated on Build → Zones."
      >
        <Text size="sm" c="dimmed">
          Zone member channels and per-zone wire name overrides are edited on the Zones wire page.
          Orphan channels (not in any zone) are controlled under Channels above.
        </Text>
      </FieldCard>

      <FieldCard
        title="Scan lists"
        description="ScanList.CSV from library scan lists and optional zone-derived lists."
      >
        <Switch
          label="Export zone-derived scan lists (ScanList.CSV)"
          description="Requires per-zone Export as scan list on the Zones page. Library scan lists still export when referenced."
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
        <Text size="sm" c="dimmed">
          Library scan list membership is edited under Library → Scan lists. Per-channel scan list
          assignment is on the Channels wire page.
        </Text>
      </FieldCard>

      <FieldCard
        title="Talk groups"
        description="DMRTalkGroups.CSV and talk group wire names referenced from channels."
      >
        <Switch
          label="Export talk groups not referenced by a channel"
          checked={build.exportUnlinkedTalkGroups !== false}
          disabled={saving}
          onChange={(event) =>
            onExportInclusionChange('exportUnlinkedTalkGroups', event.currentTarget.checked)
          }
        />
        <Switch
          label="Use talk group abbreviations when shortening"
          description="Prefer each talk group's abbreviation field before dictionary rules."
          checked={resolvedSettings.useTalkGroupAbbreviation}
          disabled={saving || !resolvedSettings.shortenNames}
          onChange={(event) =>
            onExportSettingsPatch({ useTalkGroupAbbreviation: event.currentTarget.checked })
          }
        />
      </FieldCard>

      <FieldCard
        title="Contacts"
        description="DMRDigitalContactList.CSV and private contact references on channels."
      >
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
        <DigitalContactExportNameModeSelect
          value={resolvedSettings.digitalContactExportNameMode}
          disabled={saving}
          onChange={(digitalContactExportNameMode) =>
            onExportSettingsPatch({ digitalContactExportNameMode })
          }
        />
      </FieldCard>

      <FieldCard
        title="RX group lists"
        description="DMRReceiveGroupCallList.CSV and receive-group references on channels."
      >
        <Switch
          label="Export RX group lists not referenced by a channel"
          checked={build.exportUnlinkedRxGroupLists !== false}
          disabled={saving}
          onChange={(event) =>
            onExportInclusionChange('exportUnlinkedRxGroupLists', event.currentTarget.checked)
          }
        />
      </FieldCard>

      <Text size="xs" c="dimmed">
        Export preferences are saved with this build and included in native YAML export.
      </Text>
    </Stack>
  );
}
