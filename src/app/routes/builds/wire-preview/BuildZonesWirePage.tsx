import { Stack, Text } from '@mantine/core';
import BuildWirePreviewListPage from './BuildWirePreviewListPage.tsx';
import { useZoneScanExportLayout } from '../../../hooks/useZoneScanExportLayout.ts';
import ZoneScanOverrideSection from '../../../components/builds/wirePreview/overrideModalSections/ZoneScanOverrideSection.tsx';
import { layoutEntry } from '@core/import-export/zoneDerivedScanLists/members.ts';

export default function BuildZonesWirePage() {
  const zoneScan = useZoneScanExportLayout();

  return (
    <BuildWirePreviewListPage
      title="Zones"
      entityKind="zone"
      description="Review zone export rows. Click a zone to edit wire name, skip flags, carrier frequency, and per-member scan inclusion."
      zoneScanColumn={
        zoneScan.enabled && zoneScan.layout
          ? {
              layout: zoneScan.layout,
              saving: zoneScan.saving,
              onExportScanListChange: (zoneId, enabled) =>
                zoneScan.updateZoneEntry(zoneId, { exportScanList: enabled }),
            }
          : undefined
      }
      beforeTable={
        zoneScan.enabled ? (
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              Use the Export scan list column or the row override modal. Member include toggles and
              carrier frequency persist on this build; per-member scan flags update library zones.
            </Text>
            {zoneScan.error ? (
              <Text size="sm" c="red">
                {zoneScan.error}
              </Text>
            ) : null}
          </Stack>
        ) : undefined
      }
      modalExtraSections={(row) => {
        if (
          !zoneScan.enabled ||
          !zoneScan.layout ||
          !zoneScan.library ||
          row.entityKind !== 'zone'
        ) {
          return null;
        }
        const zone = zoneScan.zoneById.get(row.libraryEntityId);
        if (!zone) return null;
        const entry = layoutEntry(zoneScan.layout, row.libraryEntityId);
        return (
          <ZoneScanOverrideSection
            zone={zone}
            zones={zoneScan.library.zones}
            entry={entry}
            channelById={zoneScan.channelById}
            isDm32={zoneScan.isDm32}
            showScanCarrierControls={zoneScan.showScanCarrierControls}
            scanListMemberCap={zoneScan.scanListMemberCap}
            saving={zoneScan.saving}
            onUpdateZoneEntry={(patch) => zoneScan.updateZoneEntry(row.libraryEntityId, patch)}
            onUpdateMemberScanInclusion={zoneScan.updateMemberScanInclusion}
          />
        );
      }}
    />
  );
}
