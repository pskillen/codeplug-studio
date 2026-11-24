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
  const navigate = useNavigate();
  const descriptor = descriptorForPair(radio ?? '', firmware ?? '');
  const [activeTab, setActiveTab] = useState<string | null>('overview');
  const [reading, setReading] = useState(false);

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

  const tabIds = radioDebugTabs(descriptor).map((tab) => tab.toLowerCase());
  const tabValue = activeTab && tabIds.includes(activeTab) ? activeTab : 'overview';

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
            options={firmwaresOf(radio!)}
            value={descriptor.firmware}
            disabled={reading}
            onChange={(next) => {
              const target = firmwaresOf(radio!).find((d) => d.firmware === next);
              if (target) navigate(debugRadioPath(target));
            }}
          />
          <RadioDebugProfile
            key={descriptor.slug}
            descriptor={descriptor}
            activeTab={tabValue}
            onTabChange={setActiveTab}
            reading={reading}
            onReadingChange={setReading}
            onFirmwareSwitch={(next) => {
              const target = firmwaresOf(radio!).find((d) => d.firmware === next);
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
  onFirmwareSwitch,
}: {
  descriptor: RadioDebugDescriptor;
  activeTab: string;
  onTabChange: (tab: string | null) => void;
  reading: boolean;
  onReadingChange: (reading: boolean) => void;
  onFirmwareSwitch: (firmware: DebugFirmwareFamily) => void;
}) {
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
  const readRadio = async () => {
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
      });
      // A capture with no notes is stored exactly as the capture path produced it.
      const labelled = Object.keys(normaliseBackupLabels(captureLabels)).length
        ? relabelDebugArchive(result, captureLabels)
        : result;
      if (historyEnabled) {
        store.add(labelled);
      } else setArchive(labelled);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Radio read failed.');
    } finally {
      controller.current = null;
      onReadingChange(false);
      setProgress(null);
    }
  };
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
