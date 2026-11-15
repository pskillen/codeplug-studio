import { atD890DebugIdentity } from '@integrations/radio-io/radios/at-d890uv/debugCoverage.ts';
import {
  dm32DebugIdentity,
  type Dm32VFrameEvidence,
} from '@integrations/radio-io/radios/dm32uv/debugCoverage.ts';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  FileButton,
  Group,
  SimpleGrid,
  Select,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import Uv5rMiniCalibrationSection from '../Uv5rMiniCalibrationSection.tsx';
import { useUv5rMiniDebugReads, type Uv5rMiniDebugRead } from '../uv5rMiniDebugReads.ts';
import { radioBackupFileName } from '@app/services/radioBackupRead.ts';
import { downloadZip } from '@integrations/download/browserDownload.ts';
import {
  openDebugArchive,
  rt95ArchiveDetails,
  uv5rMiniArchiveDetails,
  type DebugArchive,
} from './captureArchive.ts';
import { Link, useParams } from 'react-router-dom';
import { Page, PageHeader } from '@app/components/ui/index.ts';
import { KEEP_SCREEN_ON_HINT, useScreenWakeLock } from '@app/hooks/useScreenWakeLock.ts';
import { capabilityColor, radioDebugDescriptors } from './descriptors.ts';
import { CompareViewer, HexViewer, MemoryViewer } from './ArchiveViewers.tsx';
import { AtD890Memory } from './AtD890Memory.tsx';
import { Coverage } from './Coverage.tsx';
import { Uv5rMiniMemory } from './Uv5rMiniMemory.tsx';
import { Uv5rMiniCompare } from './Uv5rMiniCompare.tsx';
import { isUv5rMiniReadsZip, openUv5rMiniReadsZip } from './uv5rMiniLegacyArchive.ts';
import { archiveUv5rMiniRead } from './uv5rMiniCapture.ts';
import { getDebugReadHistory, useDebugReadHistory } from './debugReadHistory.ts';
import { DebugReadHistoryControls } from './DebugReadHistoryControls.tsx';
import { isDebugReadHistoryZip, openDebugReadHistoryZip } from './debugReadHistoryArchive.ts';

const asReturned = (frame: Dm32VFrameEvidence | undefined) =>
  !frame
    ? 'Not observed'
    : frame.failed
      ? `Failed: ${frame.failed}`
      : (frame.text ?? (frame.hex ? `0x${frame.hex.toUpperCase()}` : 'Empty reply'));

export default function RadioDebugPage() {
  const { radio } = useParams();
  return <RadioDebugProfile key={radio} radio={radio} />;
}

function RadioDebugProfile({ radio }: { radio: string | undefined }) {
  const { reads } = useUv5rMiniDebugReads();
  const descriptor = radioDebugDescriptors.find((item) => item.slug === radio);
  const historyEnabled = radio === 'uv-5r-mini' || radio === 'rt95' || radio === 'at-d890uv';
  const store = getDebugReadHistory(
    descriptor ?? { slug: 'unknown', archiveModelId: 'UV-5R Mini' },
  );
  const history = useDebugReadHistory(store);
  const [localArchive, setArchive] = useState<DebugArchive>();
  const archive = historyEnabled
    ? history.entries.find((e) => e.id === history.selectedId)?.archive
    : localArchive;
  const [otherId, setOtherId] = useState<string | null>(null);
  const other = history.entries.find((e) => e.id === otherId)?.archive;
  const [downloadedArchive, setDownloadedArchive] = useState<DebugArchive>();
  // Mini reads live in the shared store; any profile's undownloaded live capture lives only in this tab.
  const unsaved =
    !historyEnabled && archive?.source === 'live-read' && archive !== downloadedArchive;
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);
  const [preferredLive, setPreferredLive] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [reading, setReading] = useState(false);
  const { held: screenHeld } = useScreenWakeLock(reading);
  const [progress, setProgress] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const allReads = reads.map((read) => ({
    ...read,
    label: `${history.entries.find((e) => e.label === read.label)?.archive.source === 'file' ? 'File' : 'Live'} ${read.label}`,
  }));
  const miniReport = archive && uv5rMiniArchiveDetails(archive)?.report;
  const d890Identity =
    archive?.manifest.radioModelId === 'AT-D890UV'
      ? atD890DebugIdentity(
          archive.sidecars['debug/ident.bin'],
          archive.manifest.regions,
          archive.regions,
        )
      : undefined;
  const dm32Identity =
    archive?.manifest.radioModelId === 'DM-32UV'
      ? dm32DebugIdentity(archive.sidecars, archive.manifest.regions, archive.regions)
      : undefined;
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
      if (historyEnabled && isDebugReadHistoryZip(bytes)) {
        store.importArchives(openDebugReadHistoryZip(bytes, descriptor));
        setError(undefined);
        return;
      }
      let next: DebugArchive;
      let imported: readonly Uv5rMiniDebugRead[] = [];
      try {
        next = openDebugArchive(bytes, descriptor.archiveModelId);
      } catch (error) {
        // Only a ZIP that is not a backup archive at all may be the old Mini reads ZIP; every other
        // failure (model mismatch, damaged capture) keeps its own message.
        if (descriptor.slug !== 'uv-5r-mini' || !isUv5rMiniReadsZip(bytes)) throw error;
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
      setPreferredLive(null);
      if (historyEnabled) {
        store.importArchives(
          imported.length
            ? imported.map((read) => archiveUv5rMiniRead(read, read.readAt.toISOString()))
            : [next],
        );
      } else setArchive(next);
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
      if (historyEnabled) {
        const added = store.add(result);
        if (descriptor.slug === 'uv-5r-mini') setPreferredLive(`Live ${added.label}`);
      } else setArchive(result);
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
        <PageHeader title={descriptor.model} description={`${descriptor.family} profile`} />
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
                  {(descriptor.slug === 'at-d890uv'
                    ? [
                        ['Model · selected', descriptor.model],
                        ['Model · captured ident', d890Identity?.ident?.model ?? 'Unknown'],
                        [
                          'Band code · captured ident',
                          d890Identity?.ident
                            ? `0x${d890Identity.ident.bandCode.toString(16).toUpperCase().padStart(2, '0')}`
                            : 'Unknown',
                        ],
                        ['Ident version · protocol', d890Identity?.ident?.version ?? 'Unknown'],
                        ['Serial · captured LocalInfo', d890Identity?.serial ?? 'Unknown'],
                        ['Running firmware', 'Unknown'],
                        ['Firmware mod', 'Unknown'],
                        [
                          'Evidence',
                          d890Identity?.ident || d890Identity?.serial
                            ? 'Captured radio bytes'
                            : 'No radio identity observed',
                        ],
                        [
                          'Connection',
                          reading
                            ? 'Reading radio…'
                            : archive?.source === 'live-read'
                              ? 'Read complete · disconnected'
                              : 'Not connected',
                        ],
                      ]
                    : descriptor.slug === 'rt95'
                      ? [
                          ['Model · selected', descriptor.model],
                          ['Expected family', descriptor.family],
                          ['Serial · archive', archive?.manifest.serial || 'Unknown'],
                          ['Firmware · archive', archive?.manifest.firmware || 'Unknown'],
                          [
                            'PC ident [head]',
                            archive?.sidecars['debug/ident.bin']
                              ? Array.from(archive.sidecars['debug/ident.bin'], (b) =>
                                  b.toString(16).padStart(2, '0'),
                                ).join(' ')
                              : 'Not captured',
                          ],
                          [
                            'Clone channels/settings [unknown]',
                            archive && rt95ArchiveDetails(archive)?.coverage === 'captured'
                              ? 'Captured in programming image'
                              : archive && rt95ArchiveDetails(archive)?.coverage === 'partial'
                                ? 'Partially captured in programming image'
                                : 'Not captured',
                          ],
                          ['Running firmware', 'Unknown'],
                          ['Firmware mod', 'Unknown'],
                          ['Evidence', archive ? 'Archive manifest' : 'No radio identity observed'],
                          [
                            'Connection',
                            reading
                              ? 'Reading radio…'
                              : archive?.source === 'live-read'
                                ? 'Read complete · disconnected'
                                : 'Not connected',
                          ],
                        ]
                      : descriptor.slug === 'dm-32uv'
                        ? [
                            ['Model · selected', descriptor.model],
                            ['Model · captured PSEARCH', dm32Identity?.modelString ?? 'Unknown'],
                            [
                              'Base firmware · V01 (stock base version, unchanged by MM9PDY, so not a mod discriminator)',
                              asReturned(dm32Identity?.baseFirmware),
                            ],
                            ['Build date · V03', asReturned(dm32Identity?.buildDate)],
                            ['DSP version · V04', asReturned(dm32Identity?.dspVersion)],
                            ['Radio version · V05', asReturned(dm32Identity?.radioVersion)],
                            ['Codeplug version · V0B', asReturned(dm32Identity?.codeplugVersion)],
                            ['Serial', 'None observed'],
                            [
                              'Chip UID (8 bytes) + 4 derived, not a serial · V02',
                              dm32Identity?.chipUidHex
                                ? `0x${dm32Identity.chipUidHex.toUpperCase()}`
                                : 'Not observed',
                            ],
                            [
                              'Persistent data',
                              dm32Identity?.mm9pdyDataPresent
                                ? 'MM9PDY-compatible data present'
                                : 'No MM9PDY location page captured',
                            ],
                            ['Running firmware', 'Unknown'],
                            ['Firmware mod', 'Unknown'],
                            [
                              'Evidence',
                              dm32Identity?.modelString || dm32Identity?.vframes.length
                                ? 'Captured radio replies'
                                : 'No radio identity observed',
                            ],
                            [
                              'Connection',
                              reading
                                ? 'Reading radio…'
                                : archive?.source === 'live-read'
                                  ? 'Read complete · disconnected'
                                  : 'Not connected',
                            ],
                          ]
                        : [
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
                            [
                              'Connection',
                              reading
                                ? 'Reading radio…'
                                : archive?.source === 'live-read'
                                  ? 'Read complete · disconnected'
                                  : 'Not connected',
                            ],
                          ]
                  ).map(([label, value]) => (
                    <div key={label}>
                      <Text size="xs" c="dimmed">
                        {label}
                      </Text>
                      <Text fw={600} style={{ overflowWrap: 'anywhere' }}>
                        {value}
                      </Text>
                    </div>
                  ))}
                </SimpleGrid>
                <Text size="sm" c="dimmed" mt="md">
                  The selected family is an expectation, not proof of installed firmware.{' '}
                  {descriptor.slug === 'at-d890uv' &&
                    'Ident and LocalInfo values come from captured bytes; V100 is protocol evidence, not a running firmware version. Missing markers do not prove stock firmware.'}
                  {descriptor.slug === 'dm-32uv' &&
                    'Values come from the captured PSEARCH and V-frame replies, as returned. This radio has no readable serial. A location page is persistent data, not proof of running firmware; its absence does not prove stock.'}
                </Text>
              </Card>
              <Card withBorder>
                <Title order={3}>Capabilities</Title>
                <Stack gap="xs" mt="md">
                  {descriptor.capabilities.map((capability) => (
                    <Text component="div" key={capability.name}>
                      {capability.name} ·{' '}
                      <Badge color={capabilityColor(capability.status)} title={capability.status}>
                        {capability.status}
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
              {descriptor.slug === 'at-d890uv' && (
                <Alert title="Read-only capture and recovery">
                  The radio is read at fixed 16-byte blocks; vital units are read twice and can take
                  time. If a read fails or is cancelled, power-cycle the radio before continuing. A
                  fresh LocalInfo check precedes END, but the check and END are not atomic. Firmware
                  may divert vital reads.
                </Alert>
              )}
              {descriptor.slug === 'dm-32uv' && (
                <Alert title="Read-only capture and recovery">
                  The capture sends only the handshake, two factory-sector reads, the V-frame
                  queries, PROGRAM entry and reads inside the radio&apos;s configuration window, one
                  at a time. It reads only the blocks the product Read reads and can take a few
                  minutes. There is no END command on this radio: it leaves PROGRAM mode after about
                  2 seconds of silence. If a read fails or is cancelled, the session stops at once
                  with no retry; wait a few seconds, or power-cycle the radio if it does not return
                  to normal, before continuing.
                </Alert>
              )}
              <Alert title="Coverage is limited">
                The listed ranges are archive entries, not a complete physical storage or firmware
                image. Unlisted bytes are not captured; coverage outside the listed ranges is
                unknown.
              </Alert>
              {descriptor.slug === 'uv-5r-mini' && allReads.length > 0 && (
                <Text>
                  Reads in this tab:{' '}
                  {allReads
                    .map((read) => `${read.label} (${read.readAt.toLocaleString()})`)
                    .join(', ')}
                </Text>
              )}
              {historyEnabled && (
                <DebugReadHistoryControls
                  descriptor={descriptor}
                  store={store}
                  onClear={() => {
                    setOtherId(null);
                    setPreferredLive(null);
                  }}
                />
              )}
              {archive && (
                <Stack>
                  <Coverage
                    key={archive.manifest.capturedAt + archive.zipBytes.length}
                    archive={archive}
                  />
                  <Button
                    onClick={async () => {
                      const result = await downloadZip(
                        archive.zipBytes,
                        radioBackupFileName(archive.manifest),
                      );
                      if (result.status !== 'failed') {
                        if (historyEnabled && history.selectedId)
                          store.markDownloaded([history.selectedId]);
                        else setDownloadedArchive(archive);
                      }
                    }}
                  >
                    Download archive
                  </Button>
                </Stack>
              )}
            </Stack>
          </Tabs.Panel>
          <Tabs.Panel value="memory" pt="md">
            {archive?.manifest.radioModelId === 'UV-5R Mini' ? (
              <Uv5rMiniMemory archive={archive} />
            ) : descriptor.slug === 'at-d890uv' ? (
              <AtD890Memory archive={archive} />
            ) : descriptor.slug === 'dm-32uv' ? (
              <Alert title="Memory unavailable">
                This capability is not yet available for this profile.
              </Alert>
            ) : (
              <MemoryViewer archive={archive} />
            )}
          </Tabs.Panel>
          <Tabs.Panel value="hex" pt="md">
            <HexViewer key={archive?.manifest.capturedAt} archive={archive} />
          </Tabs.Panel>
          <Tabs.Panel value="compare" pt="md">
            {descriptor.slug === 'at-d890uv' && (
              <Alert title="Responding unit unknown">
                These byte comparisons do not establish which physical unit responded. Firmware may
                divert reads; equal bytes and repeated-read agreement do not prove unit identity.
              </Alert>
            )}
            {(descriptor.slug === 'rt95' || descriptor.slug === 'at-d890uv') && (
              <Select
                label="Compare with"
                clearable
                value={otherId}
                onChange={setOtherId}
                data={history.entries.map((e) => ({
                  value: e.id,
                  label: `${e.label} · ${new Date(e.readAt).toLocaleString()}`,
                }))}
              />
            )}
            {descriptor.slug === 'uv-5r-mini' ? (
              <Uv5rMiniCompare
                key={history.entries[0]?.id ?? 'empty'}
                reads={allReads}
                preferredLive={preferredLive}
                onOpenArchive={openFile}
              />
            ) : historyEnabled ? (
              <CompareViewer
                archive={archive}
                other={other}
                modelId={descriptor.archiveModelId}
                DecodedDiff={descriptor.DecodedDiff}
              />
            ) : (
              <CompareViewer archive={archive} modelId={descriptor.archiveModelId} />
            )}
          </Tabs.Panel>
          {descriptor.slug === 'uv-5r-mini' && (
            <Tabs.Panel value="calibration" pt="md">
              <Uv5rMiniCalibrationSection
                key={history.entries[0]?.id ?? 'empty'}
                reads={allReads}
                preferredLive={
                  history.entries.find((e) => e.id === history.selectedId)
                    ? `${history.entries.find((e) => e.id === history.selectedId)!.archive.source === 'file' ? 'File' : 'Live'} ${history.entries.find((e) => e.id === history.selectedId)!.label}`
                    : preferredLive
                }
              />
            </Tabs.Panel>
          )}
          {(descriptor.slug === 'rt95' || descriptor.slug === 'at-d890uv') && (
            <Tabs.Panel value="calibration" pt="md">
              <Stack>
                <Select
                  label="Calibration overlay"
                  clearable
                  value={otherId}
                  onChange={setOtherId}
                  data={history.entries.map((e) => ({
                    value: e.id,
                    label: `${e.label} · ${new Date(e.readAt).toLocaleString()}`,
                  }))}
                />
                {descriptor.Calibration && (
                  <descriptor.Calibration archive={archive} overlayArchive={other} />
                )}
              </Stack>
            </Tabs.Panel>
          )}
          {(descriptor.slug === 'uv-5r-mini' ||
          descriptor.slug === 'at-d890uv' ||
          descriptor.slug === 'rt95'
            ? ['Trace']
            : ['Calibration', 'Trace']
          ).map((tab) => (
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
