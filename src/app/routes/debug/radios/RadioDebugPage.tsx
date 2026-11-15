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
import { useEffect, useRef, useState } from 'react';
import Uv5rMiniCalibrationSection from '../Uv5rMiniCalibrationSection.tsx';
import {
  buildUv5rMiniReadsZip,
  useUv5rMiniDebugReads,
  uv5rMiniDebugReadStore,
  type Uv5rMiniDebugRead,
} from '../uv5rMiniDebugReads.ts';
import {
  hashUv5rMiniDebugSpans,
  UV5R_MINI_FULL_READ_SIZE,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import { downloadZip } from '@integrations/download/browserDownload.ts';
import { openDebugArchive, uv5rMiniArchiveDetails, type DebugArchive } from './captureArchive.ts';
import { Link, useParams } from 'react-router-dom';
import { Page, PageHeader } from '@app/components/ui/index.ts';
import { KEEP_SCREEN_ON_HINT, useScreenWakeLock } from '@app/hooks/useScreenWakeLock.ts';
import { radioDebugDescriptors } from './descriptors.ts';
import { CompareViewer, HexViewer, MemoryViewer } from './ArchiveViewers.tsx';
import { Coverage } from './Coverage.tsx';
import { Uv5rMiniMemory } from './Uv5rMiniMemory.tsx';
import { Uv5rMiniCompare } from './Uv5rMiniCompare.tsx';
import { openUv5rMiniReadsZip } from './uv5rMiniLegacyArchive.ts';
import { archiveUv5rMiniRead } from './uv5rMiniCapture.ts';

export default function RadioDebugPage() {
  const { radio } = useParams();
  return <RadioDebugProfile key={radio} radio={radio} />;
}

function RadioDebugProfile({ radio }: { radio: string | undefined }) {
  const { reads, undownloaded } = useUv5rMiniDebugReads();
  useEffect(() => {
    if (!undownloaded) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [undownloaded]);
  const [legacyReads, setLegacyReads] = useState<readonly Uv5rMiniDebugRead[]>([]);
  const [archive, setArchive] = useState<DebugArchive>();
  const [preferredLive, setPreferredLive] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [reading, setReading] = useState(false);
  const { held: screenHeld } = useScreenWakeLock(reading);
  const [progress, setProgress] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const offlineRead: Uv5rMiniDebugRead | undefined =
    archive?.manifest.radioModelId === 'UV-5R Mini' &&
    archive.source === 'file' &&
    archive.regions.clone?.length === UV5R_MINI_FULL_READ_SIZE
      ? {
          label: 'File archive',
          readAt: new Date(archive.manifest.capturedAt),
          raw: archive.sidecars['debug/wire.bin']!,
          decoded: archive.regions.clone,
          ident: { f: archive.sidecars['debug/f.bin']!, m: archive.sidecars['debug/m.bin']! },
          spans: hashUv5rMiniDebugSpans(archive.regions.clone),
        }
      : undefined;
  const liveReads = reads.map((read) => ({ ...read, label: `Live ${read.label}` }));
  const fileReads = [...legacyReads, ...(offlineRead && !legacyReads.length ? [offlineRead] : [])];
  const allReads =
    archive?.source === 'live-read' ? [...fileReads, ...liveReads] : [...liveReads, ...fileReads];
  const miniReport = archive && uv5rMiniArchiveDetails(archive)?.report;
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
      const bytes = new Uint8Array(await file.arrayBuffer());
      let next: DebugArchive;
      let imported: readonly Uv5rMiniDebugRead[] = [];
      try {
        next = openDebugArchive(bytes, descriptor.archiveModelId);
      } catch (error) {
        if (descriptor.slug !== 'uv-5r-mini') throw error;
        imported = openUv5rMiniReadsZip(bytes).map((read) => ({
          ...read,
          label: `File ${read.label}`,
        }));
        const last = imported.at(-1)!;
        next = {
          ...archiveUv5rMiniRead(last, last.readAt.toISOString()),
          source: 'file',
          zipBytes: bytes,
        };
      }
      setLegacyReads(imported);
      setPreferredLive(null);
      setArchive(next);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open archive.');
    }
  };
  const readRadio = async () => {
    if (!descriptor.capture) return;
    setReading(true);
    controller.current = new AbortController();
    setError(undefined);
    try {
      const result = await descriptor.capture({
        signal: controller.current.signal,
        onProgress: (p) => setProgress(p.msg),
      });
      if (descriptor.slug === 'uv-5r-mini') {
        const latest = uv5rMiniDebugReadStore.getSnapshot().reads.at(-1);
        if (latest) setPreferredLive(`Live ${latest.label}`);
      }
      setArchive(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Radio read failed.');
    } finally {
      controller.current = null;
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
                    ['Firmware mod', miniReport ? 'MM9PDY compatible report' : 'Unknown'],
                    [
                      'Evidence',
                      miniReport
                        ? 'Validated live format-2 MM9R report'
                        : archive
                          ? 'Archive manifest'
                          : 'No radio identity observed',
                    ],
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
                  {reading && (
                    <>
                      <Button variant="default" onClick={() => controller.current?.abort()}>
                        Cancel
                      </Button>
                      <Text>{progress || 'Connecting…'}</Text>
                      {!screenHeld && (
                        <Text size="sm" c="dimmed" data-testid="keep-screen-on-hint">
                          {KEEP_SCREEN_ON_HINT}
                        </Text>
                      )}
                    </>
                  )}
                </Group>
              )}
              <Alert title="Coverage is limited">
                The listed ranges are archive entries, not a complete physical storage or firmware
                image. Unlisted bytes are not captured; coverage outside the listed ranges is
                unknown.
              </Alert>
              {descriptor.slug === 'uv-5r-mini' && allReads.length > 0 && (
                <Stack>
                  <Text>
                    Reads in this tab:{' '}
                    {allReads
                      .map((read) => `${read.label} (${read.readAt.toLocaleString()})`)
                      .join(', ')}
                  </Text>
                  {reads.length > 0 && (
                    <>
                      <Text>
                        {undownloaded
                          ? `${undownloaded} reads not downloaded`
                          : 'All reads downloaded'}
                      </Text>
                      <Button
                        onClick={async () => {
                          const result = await downloadZip(
                            buildUv5rMiniReadsZip(reads),
                            'uv5r-mini-reads.zip',
                          );
                          if (result.status !== 'failed')
                            uv5rMiniDebugReadStore.markAllDownloaded(reads.length);
                        }}
                      >
                        Download all reads
                      </Button>
                    </>
                  )}
                </Stack>
              )}
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
            {archive?.manifest.radioModelId === 'UV-5R Mini' ? (
              <Uv5rMiniMemory archive={archive} />
            ) : (
              <MemoryViewer archive={archive} />
            )}
          </Tabs.Panel>
          <Tabs.Panel value="hex" pt="md">
            <HexViewer key={archive?.manifest.capturedAt} archive={archive} />
          </Tabs.Panel>
          <Tabs.Panel value="compare" pt="md">
            {descriptor.slug === 'uv-5r-mini' ? (
              <Uv5rMiniCompare reads={allReads} preferredLive={preferredLive} />
            ) : (
              <CompareViewer archive={archive} modelId={descriptor.archiveModelId} />
            )}
          </Tabs.Panel>
          {descriptor.slug === 'uv-5r-mini' && (
            <Tabs.Panel value="calibration" pt="md">
              <Uv5rMiniCalibrationSection reads={allReads} preferredLive={preferredLive} />
            </Tabs.Panel>
          )}
          {(descriptor.slug === 'uv-5r-mini' ? ['Trace'] : ['Calibration', 'Trace']).map((tab) => (
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
