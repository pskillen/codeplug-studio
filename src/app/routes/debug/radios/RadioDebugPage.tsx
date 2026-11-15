import { Alert, Anchor, Badge, Card, SimpleGrid, Stack, Tabs, Text, Title } from '@mantine/core';
import { Link, useParams } from 'react-router-dom';
import { Page, PageHeader } from '@app/components/ui/index.ts';
import { radioDebugDescriptors } from './descriptors.ts';

export default function RadioDebugPage() {
  const { radio } = useParams();
  const descriptor = radioDebugDescriptors.find((item) => item.slug === radio);
  if (!descriptor)
    return (
      <Page>
        <PageHeader title="Radio not found" />
        <Anchor component={Link} to="/debug">
          All debug tools
        </Anchor>
      </Page>
    );
  return (
    <Page>
      <Stack>
        <Anchor component={Link} to="/debug">
          ← All debug tools
        </Anchor>
        <PageHeader
          title={descriptor.model}
          description={`${descriptor.family} profile · Not connected`}
        />
        <Tabs defaultValue="overview">
          <Tabs.List style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
            {['Overview', 'Backup', 'Calibration', 'Memory', 'Hex', 'Compare', 'Trace'].map(
              (tab) => (
                <Tabs.Tab key={tab} value={tab.toLowerCase()}>
                  {tab}
                </Tabs.Tab>
              ),
            )}
          </Tabs.List>
          <Tabs.Panel value="overview" pt="md">
            <Stack>
              <Card withBorder>
                <Title order={3}>Identity and firmware</Title>
                <SimpleGrid cols={{ base: 2, sm: 3 }} mt="md">
                  {[
                    ['Model · selected', descriptor.model],
                    ['Expected family', descriptor.family],
                    ['Serial · radio report', 'Unknown'],
                    ['Firmware · radio report', 'Unknown'],
                    ['Firmware mod', 'Unknown'],
                    ['Evidence', 'No radio identity observed'],
                    ['Connection', 'Not connected'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <Text size="xs" c="dimmed">
                        {label}
                      </Text>
                      <Text fw={600}>{value}</Text>
                    </div>
                  ))}
                </SimpleGrid>
                <Text size="sm" c="dimmed" mt="md">
                  The selected family is an expectation, not proof of installed firmware.
                </Text>
              </Card>
              <Card withBorder>
                <Title order={3}>Capabilities</Title>
                <Stack gap="xs" mt="md">
                  {descriptor.capabilities.map((capability) => (
                    <Text component="div" key={capability.name}>
                      {capability.name} · <Badge color="gray">{capability.status}</Badge>
                    </Text>
                  ))}
                </Stack>
              </Card>
              <Alert title="Radio diagnostics unavailable">
                This profile has no debug adapter yet. No connection or radio read is available on
                this page.
              </Alert>
            </Stack>
          </Tabs.Panel>
          {['Backup', 'Calibration', 'Memory', 'Hex', 'Compare', 'Trace'].map((tab) => (
            <Tabs.Panel key={tab} value={tab.toLowerCase()} pt="md">
              <Alert title={`${tab} unavailable`}>
                This capability is not yet available for this profile.
              </Alert>
            </Tabs.Panel>
          ))}
        </Tabs>
      </Stack>
    </Page>
  );
}
