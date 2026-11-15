import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  FileButton,
  Group,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import { downloadZip } from '@integrations/download/browserDownload.ts';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';
import { Link, useParams } from 'react-router-dom';
import { Page, PageHeader } from '@app/components/ui/index.ts';
import { radioDebugDescriptors } from './descriptors.ts';
import { CompareViewer, HexViewer, MemoryViewer } from './ArchiveViewers.tsx';
import { Coverage } from './Coverage.tsx';

export default function RadioDebugPage() {
  const { radio } = useParams();
  return <RadioDebugProfile key={radio} radio={radio} />;
}

function RadioDebugProfile({ radio }: { radio: string | undefined }) {
  const [archive, setArchive] = useState<DebugArchive>();
  const [error, setError] = useState<string>();
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState('');
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
  const openFile = async (file: File | null) => {
    if (!file) return;
    try {
      const next = openDebugArchive(
        new Uint8Array(await file.arrayBuffer()),
        descriptor.archiveModelId,
      );
      setArchive(next);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open archive.');
    }
  };
  const readRadio = async () => {
    if (!descriptor.capture) return;
    setReading(true);
    setError(undefined);
    try {
      setArchive(await descriptor.capture({ onProgress: (p) => setProgress(p.msg) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Radio read failed.');
    } finally {
      setReading(false);
      setProgress('');
    }
  };
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
        <Group>
          <FileButton onChange={openFile} accept=".zip,application/zip">
            {(props) => (
              <Button variant="default" {...props}>
                Open archive
              </Button>
            )}
          </FileButton>
        </Group>
        {error && (
          <Alert color="red" title="Operation failed">
            {error}
          </Alert>
        )}
        {archive && (
          <Text size="sm">
            {archive.source === 'file' ? 'Local archive' : 'Live read'} · captured{' '}
            {archive.manifest.capturedAt} · {archive.manifest.regions.length} regions
          </Text>
        )}
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
                    ['Serial · archive', archive?.manifest.serial || 'Unknown'],
                    ['Firmware · archive', archive?.manifest.firmware || 'Unknown'],
                    ['Firmware mod', 'Unknown'],
                    ['Evidence', archive ? 'Archive manifest' : 'No radio identity observed'],
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
                      {capability.name} ·{' '}
                      <Badge
                        color={
                          descriptor.capture && capability.name === 'Backup' ? 'green' : 'gray'
                        }
                        title={
                          descriptor.capture && capability.name === 'Backup'
                            ? 'Live capture available'
                            : capability.status
                        }
                      >
                        {descriptor.capture && capability.name === 'Backup'
                          ? 'Available'
                          : 'Unavailable'}
                      </Badge>
                    </Text>
                  ))}
                </Stack>
              </Card>
              {!descriptor.capture && (
                <Alert title="Radio diagnostics unavailable">
                  This profile has no debug adapter yet. No connection or radio read is available on
                  this page.
                </Alert>
              )}
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="backup" pt="md">
            <Stack>
              <Title order={3}>Backup</Title>
              <Text>
                Open a compatible local archive to inspect its captured ranges.{' '}
                {descriptor.capture
                  ? 'Read the radio to make a new capture.'
                  : 'Live radio capture is not available yet.'}
              </Text>
              {descriptor.capture && (
                <Group>
                  <Button onClick={readRadio} loading={reading}>
                    Read radio
                  </Button>
                  {reading && <Text>{progress || 'Connecting…'}</Text>}
                </Group>
              )}
              <Alert title="Coverage is limited">
                The listed ranges are archive entries, not a complete physical storage or firmware
                image. Unlisted bytes are not captured; coverage outside the listed ranges is
                unknown.
              </Alert>
              {archive && (
                <Stack>
                  <Coverage
                    key={archive.manifest.capturedAt + archive.zipBytes.length}
                    archive={archive}
                  />
                  <Button onClick={() => downloadZip(archive.zipBytes, 'radio-debug-archive.zip')}>
                    Download archive
                  </Button>
                </Stack>
              )}
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="memory" pt="md">
            <MemoryViewer archive={archive} />
          </Tabs.Panel>
          <Tabs.Panel value="hex" pt="md">
            <HexViewer key={archive?.manifest.capturedAt} archive={archive} />
          </Tabs.Panel>
          <Tabs.Panel value="compare" pt="md">
            <CompareViewer archive={archive} modelId={descriptor.archiveModelId} />
          </Tabs.Panel>
          {['Calibration', 'Trace'].map((tab) => (
            <Tabs.Panel key={tab} value={tab.toLowerCase()} pt="md">
              <Alert title={`${tab} unavailable`}>
                {tab === 'Trace'
                  ? 'Protocol trace export is unavailable: this capture does not include trace instrumentation.'
                  : 'This capability is not yet available for this profile.'}
              </Alert>
            </Tabs.Panel>
          ))}
        </Tabs>
      </Stack>
    </Page>
  );
}
