import { useMemo } from 'react';
import { Alert, Stack, Title } from '@mantine/core';
import { SettingsTable, useSensitiveReveal } from '@app/components/debug/index.ts';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import type { RadioDebugDescriptor } from './descriptors.ts';
import type { DebugArchive } from './captureArchive.ts';
import { archiveKey } from './viewerUtils.ts';

type SettingsBuilder = NonNullable<RadioDebugDescriptor['settings']>;

/**
 * The shared Settings tab: the radio's `settings(archive)` view drawn by `SettingsTable`. Holds no
 * radio text; the view carries every sentence.
 */
export function SettingsTab({
  archive,
  settings,
}: {
  archive?: DebugArchive;
  settings: SettingsBuilder;
}) {
  if (!archive)
    return (
      <Stack>
        <Title order={3}>Settings</Title>
        <Alert title="No capture">Open or read a capture to inspect its settings.</Alert>
      </Stack>
    );
  return <SettingsTabLoaded key={archiveKey(archive)} archive={archive} settings={settings} />;
}

function SettingsTabLoaded({
  archive,
  settings,
}: {
  archive: DebugArchive;
  settings: SettingsBuilder;
}) {
  const reveal = useSensitiveReveal(archive ? archiveKey(archive) : undefined);
  const view = useMemo(() => settings(archive), [archive, settings]);
  return (
    <Stack>
      <Title order={3}>Settings</Title>
      <DesignSystemV2Provider>
        <SettingsTable view={view} revealed={reveal.revealed} onToggleReveal={reveal.toggle} />
      </DesignSystemV2Provider>
    </Stack>
  );
}
