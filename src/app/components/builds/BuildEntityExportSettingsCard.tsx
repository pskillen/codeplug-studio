import type { ReactNode } from 'react';
import { Button, Group, Stack, Switch, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import type { FormatBuild } from '@core/models/formatBuild.ts';
import type { ChannelExportNameMode } from '@core/domain/channelNaming.ts';
import type { DigitalContactExportNameMode } from '@core/import-export/types.ts';
import type { WirePreviewEntityKind } from '@core/services/previewWireRows.ts';
import { FieldCard } from '../fields/Fields.tsx';
import ExportNameModeSelect from './ExportNameModeSelect.tsx';
import DigitalContactExportNameModeSelect from './DigitalContactExportNameModeSelect.tsx';
import UseLibraryAbbreviationsSwitch from './UseLibraryAbbreviationsSwitch.tsx';
import type { ResolvedBuildExportSettings } from '../../lib/buildExportSettingsUi.ts';

export type BuildEntityInclusionField =
  | 'exportUnlinkedChannels'
  | 'exportUnlinkedTalkGroups'
  | 'exportUnlinkedRxGroupLists'
  | 'exportUnlinkedDigitalContacts'
  | 'exportUnlinkedAnalogContacts';

export interface BuildEntityExportSettingsCardProps {
  build: FormatBuild;
  entityKind: WirePreviewEntityKind;
  saving?: boolean;
  exportSettings: ResolvedBuildExportSettings;
  showExportNameMode?: boolean;
  showDigitalContactExportNameMode?: boolean;
  showLibraryAbbreviations?: boolean;
  onExportSettingsPatch: (patch: {
    nameModeOverride?: ChannelExportNameMode;
    digitalContactExportNameMode?: DigitalContactExportNameMode;
    useChannelAbbreviation?: boolean;
    useTalkGroupAbbreviation?: boolean;
  }) => void;
  onExportInclusionChange: (field: BuildEntityInclusionField, checked: boolean) => void;
  /** Extra actions inside the card (e.g. bulk edit). */
  actions?: ReactNode;
}

function cardCopy(
  entityKind: WirePreviewEntityKind,
): { title: string; description: string } | null {
  switch (entityKind) {
    case 'channel':
      return {
        title: 'Channels',
        description:
          'Settings for this radio build only. Your library stays unchanged — these choices shape what is written on export.',
      };
    case 'talkGroup':
      return {
        title: 'Talk groups',
        description:
          'Settings for this radio build only. Talk groups linked to exported channels are always included.',
      };
    case 'contact':
      return {
        title: 'Contacts',
        description:
          'Settings for this radio build only. Contacts linked to exported channels are always included.',
      };
    case 'rxGroupList':
      return {
        title: 'RX group lists',
        description:
          'Settings for this radio build only. Lists linked to exported channels are always included.',
      };
    default:
      return null;
  }
}

/**
 * Entity-scoped export settings mirrored from the Export page onto Build → entity routes.
 */
export default function BuildEntityExportSettingsCard({
  build,
  entityKind,
  saving = false,
  exportSettings,
  showExportNameMode = false,
  showDigitalContactExportNameMode = false,
  showLibraryAbbreviations = false,
  onExportSettingsPatch,
  onExportInclusionChange,
  actions,
}: BuildEntityExportSettingsCardProps) {
  const copy = cardCopy(entityKind);
  if (!copy) return null;

  const isChirp = build.formatId === 'chirp';

  return (
    <FieldCard title={copy.title} description={copy.description}>
      <Stack gap="sm">
        {entityKind === 'channel' ? (
          <Switch
            label={
              isChirp
                ? 'Export channels not in the memory list'
                : 'Export channels not linked to a zone'
            }
            description="Turn this off to keep orphan channels out of this build’s export."
            checked={build.exportUnlinkedChannels !== false}
            disabled={saving}
            onChange={(event) =>
              onExportInclusionChange('exportUnlinkedChannels', event.currentTarget.checked)
            }
          />
        ) : null}
        {entityKind === 'talkGroup' ? (
          <Switch
            label="Export talk groups not referenced by a channel"
            description="Turn this off to keep unused talk groups out of this build’s export."
            checked={build.exportUnlinkedTalkGroups !== false}
            disabled={saving}
            onChange={(event) =>
              onExportInclusionChange('exportUnlinkedTalkGroups', event.currentTarget.checked)
            }
          />
        ) : null}
        {entityKind === 'rxGroupList' ? (
          <Switch
            label="Export RX group lists not referenced by a channel"
            description="Turn this off to keep unused RX group lists out of this build’s export."
            checked={build.exportUnlinkedRxGroupLists !== false}
            disabled={saving}
            onChange={(event) =>
              onExportInclusionChange('exportUnlinkedRxGroupLists', event.currentTarget.checked)
            }
          />
        ) : null}
        {entityKind === 'contact' ? (
          <>
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

        {showExportNameMode ? (
          <ExportNameModeSelect
            value={exportSettings.nameModeOverride}
            onChange={(nameModeOverride) => onExportSettingsPatch({ nameModeOverride })}
            description="Fallback style for channels without an explicit wire name override on this build."
          />
        ) : null}
        {showDigitalContactExportNameMode ? (
          <DigitalContactExportNameModeSelect
            value={exportSettings.digitalContactExportNameMode}
            onChange={(digitalContactExportNameMode) =>
              onExportSettingsPatch({ digitalContactExportNameMode })
            }
          />
        ) : null}
        {showLibraryAbbreviations ? (
          <UseLibraryAbbreviationsSwitch
            shortenNames={exportSettings.shortenNames}
            value={exportSettings.useChannelAbbreviation && exportSettings.useTalkGroupAbbreviation}
            onChange={(useLibraryAbbreviations) =>
              onExportSettingsPatch({
                useChannelAbbreviation: useLibraryAbbreviations,
                useTalkGroupAbbreviation: useLibraryAbbreviations,
              })
            }
          />
        ) : null}

        {actions ? (
          <Group gap="sm" mt="xs">
            {actions}
          </Group>
        ) : null}

        <Text size="xs" c="dimmed">
          The same controls also appear on <Link to={`/builds/${build.id}/export`}>Export</Link> for
          this build.
        </Text>
      </Stack>
    </FieldCard>
  );
}

/** Prominent bulk-edit CTA for the Channels settings card. */
export function ChannelsBulkEditAction({ buildId }: { buildId: string }) {
  return (
    <Button component={Link} to={`/builds/${buildId}/channels/bulk`} variant="filled" size="sm">
      Bulk edit names and skip…
    </Button>
  );
}
