import BuildEntityWirePage from './BuildEntityWirePage.tsx';

export default function BuildChannelsWirePage() {
  return (
    <BuildEntityWirePage
      title="Channels"
      entityKind="channel"
      description="Toggle inclusion and override wire names. Multi-mode channels may appear as separate rows."
      showExportNameMode
    />
  );
}
