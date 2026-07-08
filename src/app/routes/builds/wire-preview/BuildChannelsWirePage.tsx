import BuildEntityWirePage from './BuildEntityWirePage.tsx';
import BuildFlatMemoryChannelsPage from '../BuildFlatMemoryChannelsPage.tsx';
import { useBuildLayout } from '../BuildLayoutContext.tsx';

export default function BuildChannelsWirePage() {
  const { build } = useBuildLayout();

  if (build.formatId === 'chirp') {
    return <BuildFlatMemoryChannelsPage />;
  }

  return (
    <BuildEntityWirePage
      title="Channels"
      entityKind="channel"
      description="Toggle inclusion, override wire names, and assign scan lists. Multi-mode channels may appear as separate rows."
      showExportNameMode
      showChannelAbbreviation
    />
  );
}
