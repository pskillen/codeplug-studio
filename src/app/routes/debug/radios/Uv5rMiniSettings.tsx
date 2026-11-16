import { Alert, Stack, Text, Title } from '@mantine/core';
import { UV5R_MINI_FULL_READ_SIZE } from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import { Uv5rMiniSettingsFrames } from '../Uv5rMiniSettingsSection.tsx';
import type { DebugArchive } from './captureArchive.ts';

/**
 * The UV-5R Mini Settings tab: the settings and VFO frames decoded from the archive's decoded clone
 * (`regions.clone`). An archive without a whole clone shows "not captured". The Mini has no password fields.
 */
export function Uv5rMiniSettings({ archive }: { archive?: DebugArchive }) {
  if (!archive)
    return (
      <Stack>
        <Title order={3}>Settings</Title>
        <Alert title="No capture">Open or read a capture to inspect its settings.</Alert>
      </Stack>
    );
  const clone = archive.regions.clone;
  return (
    <Stack gap="lg" data-testid="uv5r-mini-settings-tab">
      <Title order={3}>Settings</Title>
      {clone && clone.length === UV5R_MINI_FULL_READ_SIZE ? (
        <Uv5rMiniSettingsFrames decoded={clone} />
      ) : (
        <Text size="sm" c="dimmed">
          Not captured: this archive has no whole decoded clone, so the settings and VFO frames
          (0x9000–0x903F, 0x8000–0x803F) cannot be decoded.
        </Text>
      )}
    </Stack>
  );
}
