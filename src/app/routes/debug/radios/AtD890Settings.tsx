import { Alert, Stack, Title } from '@mantine/core';
import { projectAtD890Archive } from './debugProjections.ts';
import { SettingsPanel } from './AtD890MemorySettings.tsx';
import { useSensitiveReveal } from './useSensitiveReveal.ts';
import { archiveKey } from './viewerUtils.ts';
import type { DebugArchive } from './captureArchive.ts';

/** The AT-D890UV Settings tab: the settings decoded from the same projection Memory uses. */
export function AtD890Settings({ archive }: { archive?: DebugArchive }) {
  if (!archive)
    return (
      <Stack>
        <Title order={3}>Settings</Title>
        <Alert title="No capture">Open or read a capture to inspect its settings.</Alert>
      </Stack>
    );
  return <AtD890SettingsLoaded key={archiveKey(archive)} archive={archive} />;
}

function AtD890SettingsLoaded({ archive }: { archive: DebugArchive }) {
  const reveal = useSensitiveReveal(archive);
  const projection = projectAtD890Archive(archive);
  if (!projection)
    return (
      <Stack>
        <Title order={3}>Settings</Title>
        <Alert color="red" title="Not an AT-D890UV capture">
          This archive is for {archive.manifest.radioModelId}; nothing is decoded.
        </Alert>
      </Stack>
    );
  return (
    <Stack>
      <Title order={3}>Settings</Title>
      <SettingsPanel
        projection={projection}
        revealed={reveal.revealed}
        onToggleReveal={reveal.toggle}
      />
    </Stack>
  );
}
