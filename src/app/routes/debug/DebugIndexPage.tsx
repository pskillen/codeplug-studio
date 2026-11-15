import {
  Alert,
  Anchor,
  Badge,
  Card,
  Group,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core';
import { Link } from 'react-router-dom';
import { Page, PageHeader } from '@app/components/ui/index.ts';
import { useDeveloperMode } from '../../hooks/useDeveloperMode.ts';
import { capabilityColor, radioDebugDescriptors } from './radios/descriptors.ts';

export default function DebugIndexPage() {
  const [developerMode, setDeveloperMode] = useDeveloperMode();
  return (
    <Page>
      <PageHeader
        title="Debug"
        description="Inspect a radio, browser storage or serial transport."
      />
      <Stack gap="md">
        <Switch
          label="Developer mode on this device"
          description="Shows Debug pages and prod-hidden firmware flashing on this device. Tap the footer version five times to toggle it."
          checked={developerMode}
          onChange={(e) => setDeveloperMode(e.currentTarget.checked)}
        />
        <Alert color="yellow" title="Browser-local data">
          Data may include operator content, serial numbers and calibration. It stays in your
          browser unless you export it. Do not commit personal data.
        </Alert>
        <div>
          <Title order={2}>Radios</Title>
          <Text c="dimmed">
            Choose a model and expected firmware family. A selected profile is not evidence of
            installed firmware.
          </Text>
        </div>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
          {radioDebugDescriptors.map((radio) => (
            <Card withBorder key={radio.slug}>
              <Anchor component={Link} to={`/debug/radios/${radio.slug}`} fw={700}>
                {radio.model}
              </Anchor>
              <Text size="sm" c="dimmed">
                {radio.family}
              </Text>
              <Group gap="xs" mt="md">
                {radio.capabilities.map((capability) => (
                  <Badge
                    key={capability.name}
                    color={capabilityColor(capability.status)}
                    title={`${capability.name}: ${capability.status}`}
                  >
                    {capability.name} · {capability.status}
                  </Badge>
                ))}
              </Group>
            </Card>
          ))}
        </SimpleGrid>
        <div>
          <Title order={2}>Storage</Title>
          <Text c="dimmed">Inspect data held by this browser.</Text>
        </div>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Card withBorder>
            <Anchor component={Link} to="/debug/storage/indexed-db" fw={700}>
              IndexedDB
            </Anchor>
            <Text size="sm">Browse project and library records.</Text>
          </Card>
          <Card withBorder>
            <Anchor component={Link} to="/debug/storage/local-storage" fw={700}>
              LocalStorage
            </Anchor>
            <Text size="sm">Inspect and delete individual application keys.</Text>
          </Card>
        </SimpleGrid>
        <Title order={2}>Transport</Title>
        <Card withBorder>
          <Anchor component={Link} to="/debug/transport/serial-reopen" fw={700}>
            Serial reopen timing
          </Anchor>
          <Text size="sm">
            Measures reopen timing and sends test bytes. Connect a cable only, not a radio.
          </Text>
        </Card>
        <Title order={2}>Existing radio tools</Title>
        <Text size="sm">
          <Anchor component={Link} to="/debug/uv5r-mini">
            UV-5R Mini full read
          </Anchor>{' '}
          ·{' '}
          <Anchor component={Link} to="/debug/d890-erase-probe">
            AT-D890UV erase-unit probe
          </Anchor>{' '}
          (erase passes write to the radio).
        </Text>
      </Stack>
    </Page>
  );
}
