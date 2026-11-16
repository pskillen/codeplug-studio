import { Alert, Stack, Title } from '@mantine/core';
import { projectRt95Settings } from '@integrations/radio-io/radios/rt95/debugMemorySettings.ts';
import { Rt95SettingsPanel } from './Rt95MemorySettings.tsx';
import { useSensitiveReveal } from './useSensitiveReveal.ts';
import type { DebugArchive } from './captureArchive.ts';

/** The RT95 Settings tab: the settings held in the clone image, grouped and read-only. */
export function Rt95Settings({ archive }: { archive?: DebugArchive }) {
  const reveal = useSensitiveReveal(archive);
  if (!archive)
    return (
      <Stack>
        <Title order={3}>Settings</Title>
        <Alert title="No capture">Open or read a capture to inspect its settings.</Alert>
      </Stack>
    );
  const region = archive.manifest.regions.find((r) => r.id === 'programming-image');
  const settings = projectRt95Settings(archive.regions['programming-image'], region?.address ?? 0);
  return (
    <Stack>
      <Title order={3}>Settings</Title>
      <Rt95SettingsPanel
        settings={settings}
        revealed={reveal.revealed}
        onToggleReveal={reveal.toggle}
      />
    </Stack>
  );
}
