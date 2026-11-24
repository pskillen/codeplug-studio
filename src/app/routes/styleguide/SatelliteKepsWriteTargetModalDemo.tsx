import { useState } from 'react';
import { Group, Radio, Stack, Text } from '@mantine/core';
import { Button, ModalShell } from '../../components/v2/index.ts';

/** Library Workflow A build picker — empty and filled states (demo only). */
export default function SatelliteKepsWriteTargetModalDemo() {
  const [open, setOpen] = useState<'empty' | 'filled' | null>(null);

  return (
    <Stack gap="sm">
      <Group gap="sm">
        <Button variant="secondary" onClick={() => setOpen('empty')}>
          Empty build list
        </Button>
        <Button variant="secondary" onClick={() => setOpen('filled')}>
          Builds available
        </Button>
      </Group>

      <ModalShell
        open={open === 'empty'}
        onClose={() => setOpen(null)}
        title="Select target radio"
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button size="sm" disabled>
              Continue
            </Button>
          </>
        }
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Opens the Write dialog for the build you choose, with only Satellite keps selected.
          </Text>
          <Text size="sm">
            No build can write satellite keps yet. Create a build for a radio that takes satellite
            keps, then write from here or from its Satellite keps tab.
          </Text>
        </Stack>
      </ModalShell>

      <ModalShell
        open={open === 'filled'}
        onClose={() => setOpen(null)}
        title="Select target radio"
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => setOpen(null)}>
              Continue
            </Button>
          </>
        }
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Opens the Write dialog for the build you choose, with only Satellite keps selected.
          </Text>
          <Radio.Group value="build:demo" onChange={() => undefined}>
            <Stack gap="xs">
              <Radio value="build:demo" label="Weekend HT — Anytone AT-D890UV" />
              <Radio value="build:2" label="Portable — Anytone AT-D878UVII Plus" />
            </Stack>
          </Radio.Group>
        </Stack>
      </ModalShell>
    </Stack>
  );
}
