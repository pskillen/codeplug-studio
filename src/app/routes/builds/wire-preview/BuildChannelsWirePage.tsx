import { buildUsesFlatMemoryList } from '@core/domain/exportOrderOrSlot.ts';
import { ChannelsBulkEditAction } from '../../../components/builds/BuildEntityExportSettingsCard.tsx';
import BuildFlatMemoryChannelsPage from '../BuildFlatMemoryChannelsPage.tsx';
import BuildWirePreviewListPage from './BuildWirePreviewListPage.tsx';
import { radioIoChannelDescriptionLimit } from '@core/import-export/formatProfiles.ts';
import ChannelDescriptionsCard from '../../../components/builds/ChannelDescriptionsCard.tsx';
import { useBuildLayout } from '../BuildLayoutContext.tsx';

export default function BuildChannelsWirePage() {
  const { build, activeEgress } = useBuildLayout();
  const descriptionLimit = activeEgress
    ? radioIoChannelDescriptionLimit(activeEgress.profileId)
    : null;

  if (buildUsesFlatMemoryList(build)) {
    return <BuildFlatMemoryChannelsPage />;
  }

  return (
    <BuildWirePreviewListPage
      title="Channels"
      entityKind="channel"
      description="Review exported channels. Use the pencil to edit export names inline; expansion context and mode are shown on each row (Details column, Mode column)."
      showExportNameMode
      showLibraryAbbreviations
      beforeTable={
        descriptionLimit != null && activeEgress ? (
          <ChannelDescriptionsCard egress={activeEgress} limit={descriptionLimit} />
        ) : undefined
      }
      headerActions={<ChannelsBulkEditAction buildId={build.id} />}
    />
  );
}
