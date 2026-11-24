import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import { genericIdentityRows } from '@integrations/radio-io/debugView/index.ts';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  FileButton,
  Group,
  SimpleGrid,
  Select,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core';
import {
  DebugWrongFirmwareError,
  type DebugOpenPort,
} from '@integrations/radio-io/debugHandoff.ts';
import { parseRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import { getRadioDescriptor } from '@integrations/radio-io/registry.ts';
import { useEffect, useRef, useState } from 'react';
import { radioBackupFileName } from '@app/services/radioBackupRead.ts';
import { downloadZip } from '@integrations/download/browserDownload.ts';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Page, PageHeader } from '@app/components/ui/index.ts';
import { KEEP_SCREEN_ON_HINT, useScreenWakeLock } from '@app/hooks/useScreenWakeLock.ts';
import {
  DEBUG_FIRMWARE_LABEL,
  isDebugFirmwareFamily,
  type DebugFirmwareFamily,
} from '@integrations/radio-io/debugView/index.ts';
import {
  capabilityColor,
  debugRadioPath,
  descriptorForPair,
  firmwaresOf,
  radioDebugTabs,
  type RadioDebugDescriptor,
} from './descriptors.ts';
import { DEBUG_FIRMWARE_COLOR } from './debugFirmware.ts';
import { FirmwareSwitch } from './FirmwareSwitch.tsx';
import { SiblingReads } from './SiblingReads.tsx';
import { CompareViewer, HexViewer, MemoryViewer } from './ArchiveViewers.tsx';
import { CalibrationTab } from './CalibrationTab.tsx';
import { SettingsTab } from './SettingsTab.tsx';
import { Coverage } from './Coverage.tsx';
import { DebugReadProgress } from './DebugReadProgress.tsx';
import type { ProgressUpdate } from '@integrations/radio-io/types.ts';
import { ComparePicker } from './ComparePicker.tsx';
import { RadioCompare } from './compare/RadioCompare.tsx';
import { ReadStrip } from './compare/ReadStrip.tsx';
import BackupLabelFields from '@app/components/builds/BackupLabelFields.tsx';
import {
  normaliseBackupLabels,
  type RadioBackupLabels,
} from '@integrations/radio-io/backup/index.ts';
import { relabelDebugArchive } from './captureArchive.ts';
import { getDebugReadHistory, useDebugReadHistory } from './debugReadHistory.ts';
import { DebugReadHistoryControls } from './DebugReadHistoryControls.tsx';
import { isDebugReadHistoryZip, openDebugReadHistoryZip } from './debugReadHistoryArchive.ts';
import { resolveRadioDebugTabValue } from './radioDebugTabValue.ts';
import { WrongFirmwareNotice } from './WrongFirmwareNotice.tsx';

export function RadioNotFound() {
  return (
    <DesignSystemV2Provider scheme="dark">
      <Page>
        <PageHeader title="Radio not found" />
        <Anchor component={Link} to="/debug">
          All debug tools
        </Anchor>
      </Page>
    </DesignSystemV2Provider>
  );
}

export default function RadioDebugPage() {
  const { radio, firmware } = useParams();
  const descriptor = descriptorForPair(radio ?? '', firmware ?? '');

  if (!descriptor) {
    const alternatives = radio ? firmwaresOf(radio) : [];
    if (alternatives.length > 0) {
      const label = firmware
        ? isDebugFirmwareFamily(firmware)
          ? DEBUG_FIRMWARE_LABEL[firmware]
          : firmware
        : 'unknown';
      return (
        <DesignSystemV2Provider scheme="dark">
          <Page>
            <PageHeader title={`${alternatives[0]!.model} has no ${label} page`} />
            <Stack gap="xs">
              {alternatives.map((alt) => (
                <Anchor key={alt.slug} component={Link} to={debugRadioPath(alt)}>
                  {DEBUG_FIRMWARE_LABEL[alt.firmware]}
                </Anchor>
              ))}
              <Anchor component={Link} to="/debug">
                All debug tools
              </Anchor>
            </Stack>
          </Page>
        </DesignSystemV2Provider>
      );
    }
    return <RadioNotFound />;
  }

  return <RadioDebugPageResolved radio={radio!} descriptor={descriptor} />;
}

function RadioDebugPageResolved({
  radio,
  descriptor,
}: {
  radio: string;
  descriptor: RadioDebugDescriptor;
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const [reading, setReading] = useState(false);
  const tabIds = radioDebugTabs(descriptor).map((tab) => tab.toLowerCase());
  const tabValue = resolveRadioDebugTabValue(activeTab, tabIds);
  const [handoff, setHandoff] = useState<{
    error: DebugWrongFirmwareError;
    startedAt: number;
  }>();
  const [portClosedMessage, setPortClosedMessage] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number>();
  const [portRead, setPortRead] = useState<DebugOpenPort>();
  const handoffRef = useRef(handoff);

  const handoffTarget =
    handoff && handoff.error.found !== 'unknown'
      ? descriptorForPair(radio, handoff.error.found)
      : undefined;
  const stockSibling = firmwaresOf(radio).find((d) => d.firmware === 'stock');
  const portOpen = !!(handoff?.error.port && !portClosedMessage);

  useEffect(() => {
    handoffRef.current = handoff;
  }, [handoff]);

  useEffect(() => {
    return () => {
      void handoffRef.current?.error.port?.close();
    };
  }, [radio]);

  useEffect(() => {
    if (!handoff?.error.port || portClosedMessage) return;
    const tick = () => {
      const left = Math.max(0, 60 - Math.floor((Date.now() - handoff.startedAt) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        void handoff.error.port?.close();
        setPortClosedMessage(true);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [handoff, portClosedMessage]);

  const closeHandoff = async () => {
    await handoff?.error.port?.close();
    setHandoff(undefined);
    setPortClosedMessage(false);
    setSecondsLeft(undefined);
  };

  return (
    <DesignSystemV2Provider key={radio} scheme="dark">
      <Page>
        <Stack>
          <Anchor component={Link} to="/debug">
            ← All debug tools
          </Anchor>
          <PageHeader title={descriptor.model} />
          <Badge variant="light" color={DEBUG_FIRMWARE_COLOR[descriptor.firmware]}>
            {DEBUG_FIRMWARE_LABEL[descriptor.firmware]}
          </Badge>
          <FirmwareSwitch
            options={firmwaresOf(radio)}
            value={descriptor.firmware}
            disabled={reading}
            onChange={(next) => {
              const target = firmwaresOf(radio).find((d) => d.firmware === next);
              if (target) {
                void closeHandoff();
                navigate(debugRadioPath(target));
              }
            }}
          />
          {handoff ? (
            <WrongFirmwareNotice
              error={handoff.error}
              target={handoffTarget}
              stockSibling={stockSibling}
              portOpen={portOpen}
              secondsLeft={secondsLeft}
              portClosedMessage={portClosedMessage}
              onSwitchAndRead={() => {
                if (!handoffTarget || !handoff.error.port) return;
                const port = handoff.error.port;
                setHandoff(undefined);
                setPortClosedMessage(false);
                setSecondsLeft(undefined);
                setPortRead(port);
                navigate(debugRadioPath(handoffTarget));
              }}
              onSwitchOnly={async (fw) => {
                await closeHandoff();
                const target = firmwaresOf(radio).find((d) => d.firmware === fw);
                if (target) navigate(debugRadioPath(target));
              }}
              onClose={() => void closeHandoff()}
            />
          ) : null}
          <RadioDebugProfile
            key={descriptor.slug}
            descriptor={descriptor}
            activeTab={tabValue}
            onTabChange={setActiveTab}
            reading={reading}
            onReadingChange={setReading}
            onWrongFirmware={(error) => {
              setHandoff({ error, startedAt: Date.now() });
              setPortClosedMessage(false);
              setSecondsLeft(60);
            }}
            portReadRequest={portRead}
            onPortReadConsumed={() => setPortRead(undefined)}
            onFirmwareSwitch={async (next) => {
              await closeHandoff();
              const target = firmwaresOf(radio).find((d) => d.firmware === next);
              if (target) navigate(debugRadioPath(target));
            }}
          />
        </Stack>
      </Page>
    </DesignSystemV2Provider>
  );
}

function RadioDebugProfile({
  descriptor,
  activeTab,
  onTabChange,
  reading,
  onReadingChange,
  onWrongFirmware,
  portReadRequest,
  onPortReadConsumed,
  onFirmwareSwitch,
}: {
  descriptor: RadioDebugDescriptor;
  activeTab: string;
  onTabChange: (tab: string | null) => void;
  reading: boolean;
  onReadingChange: (reading: boolean) => void;
  onWrongFirmware: (error: DebugWrongFirmwareError) => void;
  portReadRequest?: DebugOpenPort;
  onPortReadConsumed: () => void;
  onFirmwareSwitch: (firmware: DebugFirmwareFamily) => void | Promise<void>;
}) {
  const navigate = useNavigate();
  const historyEnabled = descriptor.readHistory === true;
  const store = getDebugReadHistory(descriptor);
  const history = useDebugReadHistory(store);
  const [localArchive, setArchive] = useState<DebugArchive>();
  // The Compare tab's byte diffs are heavy; they render only while the tab is open.
  const archive = historyEnabled
    ? history.entries.find((e) => e.id === history.selectedId)?.archive
    : localArchive;
  const otherId = history.compareId;
  const setOtherId = (id: string | null) => store.setCompare(id);
  const other = history.entries.find((e) => e.id === otherId)?.archive;
  const pairA = history.entries.find((e) => e.id === history.comparePair.a);
  const pairB = history.entries.find((e) => e.id === history.comparePair.b);
  const [downloadedArchive, setDownloadedArchive] = useState<DebugArchive>();
  // A profile with a shared history store keeps its reads there; any other profile's undownloaded live capture lives only in this tab.
  const unsaved =
    !historyEnabled && archive?.source === 'live-read' && archive !== downloadedArchive;
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved]);
  /** Descriptive fields typed before a read; stored in the new capture's manifest. */
  const [captureLabels, setCaptureLabels] = useState<RadioBackupLabels>({});
  // Keyed `${slug}:${optionId}` so a tick on one radio never carries to another.
  const [captureOptions, setCaptureOptions] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string>();
  const [archiveSwitch, setArchiveSwitch] = useState<{
    sibling: RadioDebugDescriptor;
    bytes: Uint8Array;
  }>();
  const { held: screenHeld } = useScreenWakeLock(reading);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const connection = reading
    ? 'Reading radio…'
    : archive?.source === 'live-read'
      ? 'Read complete · disconnected'
      : 'Not connected';
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
      try {
        next = openDebugArchive(bytes, descriptor.archiveModelId);
      } catch (error) {
        if (error instanceof Error && error.message.includes('does not match')) {
          const parsed = parseRadioBackupZip(bytes);
          const sibling = firmwaresOf(descriptor.radio).find((d) =>
            getRadioDescriptor(d.archiveModelId)?.modelIds.includes(parsed.manifest.radioModelId),
          );
          if (sibling) {
            setArchiveSwitch({ sibling, bytes });
            setError(undefined);
            return;
          }
        }
        // Only a ZIP that is not a backup archive at all may be the radio's older format; every other
        // failure (model mismatch, damaged capture) keeps its own message.
        const legacy = descriptor.openLegacyArchive?.(bytes);
        if (!legacy?.length) throw error;
        if (historyEnabled) {
          store.importArchives(legacy);
          setError(undefined);
          return;
        }
        next = { ...legacy.at(-1)!, source: 'file', zipBytes: bytes };
      }
      if (historyEnabled) store.importArchives([next]);
      else setArchive(next);
      setError(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open archive.');
    }
  };
  const runCapture = async (extra?: {
    port?: DebugOpenPort;
    keepPortOnWrongFirmware?: boolean;
  }) => {
    if (!descriptor.capture || controller.current) return;
    onReadingChange(true);
    controller.current = new AbortController();
    setError(undefined);
    try {
      const result = await descriptor.capture({
        signal: controller.current.signal,
        onProgress: (p) => setProgress({ ...p }),
        options: Object.fromEntries(
          (descriptor.captureOptions ?? []).map((option) => [
            option.id,
            captureOptions[`${descriptor.slug}:${option.id}`] === true,
          ]),
        ),
        port: extra?.port,
        keepPortOnWrongFirmware: extra?.keepPortOnWrongFirmware,
      });
      const labelled = Object.keys(normaliseBackupLabels(captureLabels)).length
        ? relabelDebugArchive(result, captureLabels)
        : result;
      if (historyEnabled) {
        store.add(labelled);
      } else setArchive(labelled);
    } catch (err) {
      if (err instanceof DebugWrongFirmwareError) {
        onWrongFirmware(err);
      } else {
        setError(err instanceof Error ? err.message : 'Radio read failed.');
      }
    } finally {
      controller.current = null;
      onReadingChange(false);
      setProgress(null);
    }
  };
  const readRadio = () => runCapture({ keepPortOnWrongFirmware: true });

  useEffect(() => {
    if (!portReadRequest) return;
    void runCapture({
      port: portReadRequest,
      keepPortOnWrongFirmware: true,
    }).finally(onPortReadConsumed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot handoff per port object
  }, [portReadRequest]);
  return (
    <>
      <Group>
        <FileButton onChange={openFile} accept=".zip,application/zip">
          {(props) => (
            <Button variant="default" {...props}>
              Open archive
            </Button>
          )}
        </FileButton>
      </Group>
      {archiveSwitch ? (
        <Alert
          color="blue"
          title={`This is a ${DEBUG_FIRMWARE_LABEL[archiveSwitch.sibling.firmware]} read.`}
        >
          <Stack gap="xs">
            <Text size="sm">Open it on the matching firmware page.</Text>
            <Button
              onClick={() => {
                const target = archiveSwitch.sibling;
                const next = openDebugArchive(archiveSwitch.bytes, target.archiveModelId);
                if (target.readHistory) getDebugReadHistory(target).importArchives([next]);
                else setArchive({ ...next, source: 'file', zipBytes: archiveSwitch.bytes });
                setArchiveSwitch(undefined);
                navigate(debugRadioPath(target));
              }}
            >
              Switch to {DEBUG_FIRMWARE_LABEL[archiveSwitch.sibling.firmware]} and open it
            </Button>
          </Stack>
        </Alert>
      ) : null}
      {error && (
        <Alert color="red" title="Operation failed">
          {error}
        </Alert>
      )}
      {archive && (
        <Text size="sm">
          {archive.source === 'file' ? 'Local archive' : 'Live read'} · captured{' '}
          {archive.manifest.capturedAt} · {archive.manifest.regions.length}{' '}
          {archive.manifest.regions.length === 1 ? 'region' : 'regions'}
        </Text>
      )}
      <Tabs
        value={activeTab}
        onChange={onTabChange}
        color={DEBUG_FIRMWARE_COLOR[descriptor.firmware]}
      >
        <Tabs.List style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
          {radioDebugTabs(descriptor).map((tab) => (
            <Tabs.Tab key={tab} value={tab.toLowerCase()}>
              {tab}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        <Tabs.Panel value="overview" pt="md">
          <Stack>
            <Card withBorder>
              <Title order={3}>Identity and firmware</Title>
              <SimpleGrid cols={{ base: 2, sm: 3 }} mt="md">
                {[
                  ['Model · selected', descriptor.model],
                  ['Firmware · expected', DEBUG_FIRMWARE_LABEL[descriptor.firmware]],
                  ...(descriptor.identityRows ?? genericIdentityRows)({
                    archive,
                    connection,
                    family: descriptor.family,
                  }),
                ].map(([label, value]) => (
                  <div key={label}>
                    <Text size="xs" c="dimmed">
                      {label}
                    </Text>
                    <Text
                      fw={600}
                      style={{ overflowWrap: 'anywhere' }}
                      c={
                        label === 'Firmware · expected'
                          ? DEBUG_FIRMWARE_COLOR[descriptor.firmware]
                          : undefined
                      }
                    >
                      {value}
                    </Text>
                  </div>
                ))}
              </SimpleGrid>
              <Text size="sm" c="dimmed" mt="md">
                The selected firmware is an expectation, not proof of installed firmware.{' '}
                {descriptor.identityNote}
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
            <SiblingReads descriptor={descriptor} onSwitch={onFirmwareSwitch} />
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
              <BackupLabelFields
                idPrefix="debug-capture"
                value={captureLabels}
                onCommit={setCaptureLabels}
                disabled={reading}
              />
            )}
            {descriptor.capture &&
              descriptor.captureOptions?.map((option) => (
                <Checkbox
                  key={option.id}
                  label={option.label}
                  description={option.description}
                  checked={captureOptions[`${descriptor.slug}:${option.id}`] === true}
                  disabled={reading}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setCaptureOptions((current) => ({
                      ...current,
                      [`${descriptor.slug}:${option.id}`]: checked,
                    }));
                  }}
                />
              ))}
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
                    <DebugReadProgress update={progress} stages={descriptor.captureStages} />
                    {!screenHeld && (
                      <Text size="sm" c="dimmed" data-testid="keep-screen-on-hint">
                        {KEEP_SCREEN_ON_HINT}
                      </Text>
                    )}
                  </>
                )}
              </Group>
            )}
            {descriptor.readNotice && (
              <Alert title={descriptor.readNotice.title}>{descriptor.readNotice.text}</Alert>
            )}
            <Alert title="Coverage is limited">
              The listed ranges are archive entries, not a complete physical storage or firmware
              image. Unlisted bytes are not captured; coverage outside the listed ranges is unknown.
            </Alert>
            {historyEnabled && <DebugReadHistoryControls descriptor={descriptor} store={store} />}
            <SiblingReads descriptor={descriptor} onSwitch={onFirmwareSwitch} />
            {archive && (
              <Stack>
                <Coverage
                  key={
                    historyEnabled
                      ? history.selectedId
                      : archive.manifest.capturedAt + archive.zipBytes.length
                  }
                  archive={archive}
                />
                <Text fw={600}>Your notes on this capture</Text>
                <BackupLabelFields
                  idPrefix="debug-selected"
                  value={{
                    radioName: archive.manifest.radioName,
                    label: archive.manifest.label,
                    description: archive.manifest.description,
                  }}
                  onCommit={(next) => {
                    try {
                      if (historyEnabled) {
                        if (history.selectedId) store.setLabels(history.selectedId, next);
                      } else setArchive(relabelDebugArchive(archive, next));
                      setError(undefined);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Could not save notes.');
                    }
                  }}
                />
                <Button
                  onClick={async () => {
                    // The id and archive are fixed when the download starts, so a selection
                    // change or a clear while saving cannot mark a different read.
                    const startedId = historyEnabled ? history.selectedId : null;
                    try {
                      const result = await downloadZip(
                        archive.zipBytes,
                        radioBackupFileName(archive.manifest),
                      );
                      if (result.status === 'failed') throw new Error('Download failed.');
                      if (historyEnabled) {
                        if (startedId) store.markDownloaded([startedId]);
                      } else setDownloadedArchive(archive);
                      setError(undefined);
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Download failed.');
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
          {descriptor.Memory ? (
            <descriptor.Memory
              key={historyEnabled ? history.selectedId : archive?.manifest.capturedAt}
              archive={archive}
              notDecoded={descriptor.memoryNotDecoded}
            />
          ) : (
            <MemoryViewer archive={archive} />
          )}
        </Tabs.Panel>
        {descriptor.settings && (
          <Tabs.Panel value="settings" pt="md">
            <SettingsTab
              key={historyEnabled ? history.selectedId : archive?.manifest.capturedAt}
              archive={archive}
              settings={descriptor.settings}
            />
          </Tabs.Panel>
        )}
        <Tabs.Panel value="hex" pt="md">
          <HexViewer
            key={historyEnabled ? history.selectedId : archive?.manifest.capturedAt}
            archive={archive}
          />
        </Tabs.Panel>
        <Tabs.Panel value="compare" pt="md">
          {historyEnabled && activeTab === 'compare' && (
            <ReadStrip descriptor={descriptor} store={store} />
          )}
          {historyEnabled && <ComparePicker store={store} onOpenArchive={openFile} />}
          {historyEnabled ? (
            activeTab === 'compare' && (
              <RadioCompare
                descriptor={descriptor}
                a={pairA?.archive}
                b={pairA === pairB ? undefined : pairB?.archive}
              />
            )
          ) : (
            <CompareViewer archive={archive} modelId={descriptor.archiveModelId} />
          )}
        </Tabs.Panel>
        {descriptor.calibration && (
          <Tabs.Panel value="calibration" pt="md">
            <CalibrationTab
              key={historyEnabled ? history.selectedId : archive?.manifest.capturedAt}
              archive={archive}
              overlayArchive={other}
              calibration={descriptor.calibration}
              entries={historyEnabled ? history.entries : []}
              readId={history.selectedId}
              overlayId={otherId}
              onRead={(id) => store.select(id)}
              onOverlay={setOtherId}
            />
          </Tabs.Panel>
        )}
        {!descriptor.calibration &&
          descriptor.Calibration &&
          descriptor.calibrationOverlay !== false && (
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
        {!descriptor.calibration &&
          descriptor.calibrationOverlay === false &&
          descriptor.Calibration && (
            <Tabs.Panel value="calibration" pt="md">
              <descriptor.Calibration archive={archive} />
            </Tabs.Panel>
          )}
        {(descriptor.Calibration || descriptor.calibration
          ? ['Trace']
          : ['Calibration', 'Trace']
        ).map((tab) => (
          <Tabs.Panel key={tab} value={tab.toLowerCase()} pt="md">
            <Alert title={`${tab} unavailable`}>
              {tab === 'Trace'
                ? 'Protocol trace export is unavailable: this capture does not include trace instrumentation.'
                : (descriptor.calibrationNote ??
                  'This capability is not yet available for this profile.')}
            </Alert>
          </Tabs.Panel>
        ))}
      </Tabs>
    </>
  );
}
