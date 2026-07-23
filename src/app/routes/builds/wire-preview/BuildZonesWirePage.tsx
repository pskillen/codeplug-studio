import { Stack, Text } from '@mantine/core';
import BuildWirePreviewListPage from './BuildWirePreviewListPage.tsx';
import { useZoneScanExportLayout } from '../../../hooks/useZoneScanExportLayout.ts';
import ZoneScanOverrideSection from '../../../components/builds/wirePreview/overrideModalSections/ZoneScanOverrideSection.tsx';
import ZoneMemberOrderSection from '../../../components/builds/wirePreview/overrideModalSections/ZoneMemberOrderSection.tsx';
import { layoutEntry } from '@core/import-export/zoneDerivedScanLists/members.ts';
import type { WirePreviewRow } from '@core/services/previewWireRows.ts';

export default function BuildZonesWirePage() {
  const zoneScan = useZoneScanExportLayout();

  const zoneModalContext = (row: WirePreviewRow) => {
    if (!zoneScan.layoutSupported || !zoneScan.layout || !zoneScan.library) {
      return null;
    }
    if (row.entityKind !== 'zone') return null;
    const zone = zoneScan.zoneById.get(row.libraryEntityId);
    if (!zone) return null;
    const entry = layoutEntry(zoneScan.layout, row.libraryEntityId);
    return { zone, entry };
  };

  return (
    <BuildWirePreviewListPage
      title="Zones"
      entityKind="zone"
      description="Review zone export rows and order. Click a zone to edit wire name, member export order, skip flags, and scan options. Use the reorder column to set build orderOrSlot (overrides library Zone.order)."
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
        zoneScan.layoutSupported ? (
          <Stack gap="xs">
            <Text size="sm" c="dimmed">
              Top-level zone order uses build overrides when set; otherwise library{' '}
              <code>Zone.order</code>. Member order overrides live in the row modal.
            </Text>
            {zoneScan.enabled ? (
              <Text size="sm" c="dimmed">
                Use the Export scan list column or the row override modal. Member include toggles
                persist on this build&apos;s zone projection (not library zones).
              </Text>
            ) : null}
            {zoneScan.error ? (
              <Text size="sm" c="red">
                {zoneScan.error}
              </Text>
            ) : null}
          </Stack>
        ) : undefined
      }
      modalMembersSection={(row) => {
        const ctx = zoneModalContext(row);
        if (!ctx || !zoneScan.library) return null;
        return (
          <ZoneMemberOrderSection
            zone={ctx.zone}
            zones={zoneScan.library.zones}
            entry={ctx.entry}
            channelById={zoneScan.channelById}
            saving={zoneScan.saving}
            expansionByChannelId={zoneScan.expansionByChannelId}
            onSetChannelIds={(channelIds) =>
              zoneScan.setZoneMemberChannelIds(row.libraryEntityId, channelIds)
            }
          />
        );
      }}
      modalScanSection={(row) => {
        if (!zoneScan.enabled) return null;
        const ctx = zoneModalContext(row);
        if (!ctx || !zoneScan.library) return null;
        return (
          <ZoneScanOverrideSection
            zone={ctx.zone}
            zones={zoneScan.library.zones}
            entry={ctx.entry}
            channelById={zoneScan.channelById}
            zoneBehaviourContext={zoneScan.zoneBehaviourContext}
            showScanCarrierControls={zoneScan.showScanCarrierControls}
            scanListMemberCap={zoneScan.scanListMemberCap}
            saving={zoneScan.saving}
            onUpdateZoneEntry={(patch) => zoneScan.updateZoneEntry(row.libraryEntityId, patch)}
            onUpdateMemberScanInclusion={zoneScan.updateMemberScanInclusion}
            expansionByChannelId={zoneScan.expansionByChannelId}
          />
        );
      }}
    />
  );
}
