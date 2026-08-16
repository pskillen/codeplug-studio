import { buildUsesFlatMemoryList } from '@core/domain/exportOrderOrSlot.ts';
import { ChannelsBulkEditAction } from '../../../components/builds/BuildEntityExportSettingsCard.tsx';
import BuildFlatMemoryChannelsPage from '../BuildFlatMemoryChannelsPage.tsx';
import BuildWirePreviewListPage from './BuildWirePreviewListPage.tsx';
import { useBuildLayout } from '../BuildLayoutContext.tsx';

export default function BuildChannelsWirePage() {
  const { build } = useBuildLayout();

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
      headerActions={<ChannelsBulkEditAction buildId={build.id} />}
    />
  );
}
