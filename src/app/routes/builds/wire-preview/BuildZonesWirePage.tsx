import { Stack, Text } from '@mantine/core';
import BuildEntityWirePage from './BuildEntityWirePage.tsx';
import { useZoneScanExportLayout } from '../../../hooks/useZoneScanExportLayout.ts';

export default function BuildZonesWirePage() {
  const zoneScan = useZoneScanExportLayout();

  const zoneScanContext =
    zoneScan.enabled && zoneScan.layout && zoneScan.library
      ? {
          layout: zoneScan.layout,
          zones: zoneScan.library.zones,
          zoneById: zoneScan.zoneById,
          channelById: zoneScan.channelById,
          isDm32: zoneScan.isDm32,
          showScanCarrierControls: zoneScan.showScanCarrierControls,
          scanListMemberCap: zoneScan.scanListMemberCap,
          saving: zoneScan.saving,
          onUpdateZoneEntry: zoneScan.updateZoneEntry,
          onUpdateMemberScanInclusion: zoneScan.updateMemberScanInclusion,
        }
      : undefined;

  return (
    <BuildEntityWirePage
      title="Zones"
      entityKind="zone"
      description="Toggle inclusion and override zone wire names for export. Zones with Don't export as its own zone in the library are marked and omitted from Zones.csv."
      beforeTable={
        zoneScan.enabled ? (
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              Expand a zone row to configure scan list membership. Export as scan list persists on
              this build; member include toggles update library zones (vendor-neutral).
            </Text>
            {zoneScan.error ? (
              <Text size="sm" c="red">
                {zoneScan.error}
              </Text>
            ) : null}
          </Stack>
        ) : undefined
      }
      zoneScanContext={zoneScanContext}
    />
  );
}
