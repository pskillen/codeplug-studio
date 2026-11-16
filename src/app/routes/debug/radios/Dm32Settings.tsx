import { Alert, Stack, Title } from '@mantine/core';
import { decodeDm32Archive } from './debugProjections.ts';
import { SettingsPanel } from './Dm32MemorySettings.tsx';
import { useSensitiveReveal } from './useSensitiveReveal.ts';
import { archiveKey } from './viewerUtils.ts';
import type { DebugArchive } from './captureArchive.ts';

/** The DM-32UV Settings tab: the settings page decoded from the same projection Memory uses. */
export function Dm32Settings({ archive }: { archive?: DebugArchive }) {
  if (!archive)
    return (
      <Stack>
        <Title order={3}>Settings</Title>
        <Alert title="No capture">Open or read a capture to inspect its settings.</Alert>
      </Stack>
    );
  return <Dm32SettingsLoaded key={archiveKey(archive)} archive={archive} />;
}

function Dm32SettingsLoaded({ archive }: { archive: DebugArchive }) {
  const reveal = useSensitiveReveal(archive);
  const decoded = decodeDm32Archive(archive);
  if (!decoded)
    return (
      <Stack>
        <Title order={3}>Settings</Title>
        <Alert color="red" title="Not a DM-32UV capture">
          This archive is for {archive.manifest.radioModelId}; nothing is decoded.
        </Alert>
      </Stack>
    );
  return (
    <Stack>
      <Title order={3}>Settings</Title>
      <SettingsPanel
        settings={decoded.settings}
        revealed={reveal.revealed}
        onToggleReveal={reveal.toggle}
      />
    </Stack>
  );
}
