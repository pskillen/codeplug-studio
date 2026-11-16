import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import { chooseCategory } from '@app/components/debug/memoryCategoriesTestUtils.ts';
import {
  decodeUv5rMiniFullRead,
  hashUv5rMiniDebugSpans,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import { buildUv5rMiniReadsZip, Uv5rMiniDebugReadStore } from '../uv5rMiniDebugReads.ts';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import RadioDebugPage from './RadioDebugPage.tsx';
import { getDebugReadHistory } from './debugReadHistory.ts';
import { gatedDebugRoute } from '../debugRoutes.tsx';
import { DEVELOPER_MODE_KEY } from '@integrations/preferences/developerMode.ts';
import { archiveDm32Capture } from './dm32Capture.ts';
import { downloadZip } from '@integrations/download/browserDownload.ts';
import { buildDebugReadHistoryZip, openDebugReadHistoryZip } from './debugReadHistoryArchive.ts';
import { unzipSync, zipSync } from 'fflate';
import { exampleArchive } from './debugReadHistory.fixture.ts';
import { dm32CalibrationCapture, dm32Capture } from './dm32Archive.fixture.ts';
import { OpenGd77ScriptedPipe } from '@integrations/radio-io/radios/opengd77/__fixtures__/scriptedPipe.ts';
import { classifyOpenGd77DebugFrame } from '@integrations/radio-io/radios/opengd77/debugGuard.ts';
import { OPENGD77_DEBUG_FIRMWARE_INFO_SIDECAR } from '@integrations/radio-io/radios/opengd77/debugCapture.ts';
import {
  OPENGD77_DM1701_MODEL_ID,
  OPENGD77_MD9600_MODEL_ID,
} from '@integrations/radio-io/radios/opengd77/hydration.ts';
import { radioDebugDescriptors } from './descriptors.ts';
import { openDebugArchive } from './captureArchive.ts';
import { syntheticOpenGd77Archive } from './opengd77.fixture.ts';

vi.mock('@integrations/download/browserDownload.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@integrations/download/browserDownload.ts')>()),
  downloadZip: vi.fn(async () => ({ status: 'saved' })),
}));

const fake = vi.hoisted(() => ({
  run: vi.fn(),
  dm32: vi.fn(),
  prod: false,
  pipe: undefined as undefined | import('@integrations/radio-io/types.ts').BytePipe,
}));
vi.mock('@integrations/radio-io/transport/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@integrations/radio-io/transport/index.ts')>()),
  isCapacitorSerialSupported: () => false,
  requestWebSerialPort: vi.fn(async () => ({})),
  openWebSerialPipe: vi.fn(async () => fake.pipe),
}));
vi.mock('@app/services/prodFeatureGate.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@app/services/prodFeatureGate.ts')>();
  return {
    ...actual,
    resolveDebugPagesGate: (options: { developerMode?: boolean }) =>
      actual.resolveDebugPagesGate({ ...options, buildEnv: fake.prod ? 'prod' : 'local' }),
  };
});
vi.mock('./dm32Capture.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./dm32Capture.ts')>()),
  captureDm32: fake.dm32,
}));
vi.mock('@app/services/uv5rMiniDebugRead.ts', () => ({
  grantUv5rMiniDebugPort: vi.fn(async () => ({})),
  runUv5rMiniDebugFullRead: fake.run,
}));
function open(slug = 'uv-5r-mini') {
  const view = render(
    <MemoryRouter initialEntries={[`/debug/radios/${slug}`]}>
      <DesignSystemV2Provider>
        <Routes>
          <Route path="/debug/radios/:radio" element={<RadioDebugPage />} />
        </Routes>
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Backup' }));
  return view;
}
describe('Mini shared page read', () => {
  it('cancels an in-flight read and reports its failure', async () => {
    fake.run.mockImplementation(
      ({ signal }: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(new Error('Cancelled'))),
        ),
    );
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(await screen.findByText('Cancelled')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument(),
    );
  });
  it('shows a failed read without replacing the page', async () => {
    fake.run.mockRejectedValueOnce(new Error('Synthetic read error'));
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    expect(await screen.findByText('Synthetic read error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Read radio' })).toBeInTheDocument();
  });
});

function syntheticRead(value: number) {
  const decoded = new Uint8Array(0x10000).fill(value);
  return {
    decoded,
    raw: decodeUv5rMiniFullRead(decoded),
    ident: { f: new Uint8Array(16), m: new Uint8Array(15) },
    spans: hashUv5rMiniDebugSpans(decoded),
  };
}

it('retains a late successful capture after unmount and shows it on return', async () => {
  const store = getDebugReadHistory({ slug: 'uv-5r-mini', archiveModelId: 'UV-5R Mini' });
  store.clear();
  let finish!: (value: ReturnType<typeof syntheticRead>) => void;
  fake.run.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const page = render(
    <MemoryRouter initialEntries={['/debug/radios/uv-5r-mini']}>
      <DesignSystemV2Provider>
        <Routes>
          <Route path="/debug/radios/:radio" element={<RadioDebugPage />} />
        </Routes>
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Backup' }));
  fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
  await waitFor(() => expect(finish).toBeDefined());
  page.unmount();
  await act(async () => finish(syntheticRead(7)));
  await waitFor(() => expect(store.getSnapshot().entries).toHaveLength(1));
  open();
  expect(screen.getByText(/Reads in this tab:.*Live A/)).toBeInTheDocument();
  store.clear();
});

it('selects the live read after opening a legacy ZIP, even after selecting a file read', async () => {
  const store = new Uv5rMiniDebugReadStore();
  store.add(syntheticRead(1), new Date('2024-01-01T12:00:00Z'));
  store.add(syntheticRead(2), new Date('2024-01-02T12:00:00Z'));
  const zip = buildUv5rMiniReadsZip(store.getSnapshot().reads);
  const file = new File([Uint8Array.from(zip)], 'reads.zip', { type: 'application/zip' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => Uint8Array.from(zip).buffer });
  fake.run.mockResolvedValueOnce(syntheticRead(3));
  open();
  const input = document.querySelector('input[type="file"]');
  expect(input).not.toBeNull();
  fireEvent.change(input!, { target: { files: [file] } });
  expect(await screen.findByText(/Local archive · captured/)).toBeInTheDocument();
  expect(screen.getByText(/Reads in this tab:/)).toHaveTextContent('File A');
  expect(screen.getByText(/Reads in this tab:/)).toHaveTextContent('File B');
  fireEvent.click(screen.getByRole('tab', { name: 'Calibration' }));
  expect(screen.getByRole('combobox', { name: 'Read' })).toHaveDisplayValue(/File B/);
  fireEvent.click(screen.getByRole('combobox', { name: 'Read' }));
  fireEvent.click(screen.getByRole('option', { name: /File A/ }));
  expect(screen.getByRole('combobox', { name: 'Read' })).toHaveDisplayValue(/File A/);
  fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));
  expect(screen.getByRole('combobox', { name: 'Compare B' })).toHaveDisplayValue(/^B ·/);
  fireEvent.click(screen.getByRole('combobox', { name: 'Compare B' }));
  fireEvent.click(screen.getByRole('option', { name: /^A ·/ }));
  expect(screen.getByRole('combobox', { name: 'Compare B' })).toHaveDisplayValue(/^A ·/);
  fireEvent.click(screen.getByRole('tab', { name: 'Backup' }));
  fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
  await screen.findByText(/Live read · captured/);
  fireEvent.click(screen.getByRole('tab', { name: 'Calibration' }));
  expect(screen.getByRole('combobox', { name: 'Read' })).toHaveDisplayValue(/Live/);
  fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));
  // B was picked explicitly, so the new live read does not move it.
  expect(screen.getByRole('combobox', { name: 'Compare B' })).toHaveDisplayValue(/^A ·/);
  expect(screen.getByRole('combobox', { name: 'Compare A' })).toHaveDisplayValue(/^B ·/);
}, 30000);

it('adds a successful live read to history with its timestamp', async () => {
  fake.run.mockResolvedValueOnce(syntheticRead(4));
  open();
  fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
  expect(await screen.findByText(/Reads in this tab:.*Live [A-Z]+ \(.+\)/)).toBeInTheDocument();
});

function rt95ArchiveFile(kind: 'missing' | 'partial' | 'captured' = 'missing') {
  const size = kind === 'captured' ? 0x32a0 : 4;
  const id = kind === 'missing' ? 'rt95-calibration' : 'programming-image';
  const zip = packRadioBackupZip(
    {
      format: 'codeplug-studio-radio-backup',
      version: 1,
      capturedAt: '2026-01-01T00:00:00Z',
      capturedVia: 'web-serial',
      app: { buildEnv: 'test', buildVersion: 'test' },
      radioModelId: 'retevis-rt95',
      descriptorLabel: 'test',
      serial: 'SYNTHETIC-SERIAL-123456789',
      firmware: 'archive-version',
      coverage: 'partial',
      imageByteLength: 4,
      regions: [
        {
          id,
          label: 'A',
          address: kind === 'missing' ? 0x3b00 : 0,
          byteLength: size,
          path: kind === 'missing' ? 'regions/rt95-calibration.bin' : 'regions/a.bin',
          restoreRole: 'inspect-only',
        },
      ],
    },
    { [id]: new Uint8Array(size) },
    { 'debug/ident.bin': Uint8Array.of(0x12, 0x34, 0xab, 0xcd) },
  );
  const file = new File([Uint8Array.from(zip)], 'rt95.zip', { type: 'application/zip' });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => Uint8Array.from(zip).buffer });
  return file;
}

it('tells a model mismatch apart from a Mini reads archive on the Mini page', async () => {
  open();
  const input = document.querySelector('input[type="file"]');
  fireEvent.change(input!, { target: { files: [rt95ArchiveFile()] } });
  expect(
    await screen.findByText('Archive model retevis-rt95 does not match this profile.'),
  ).toBeInTheDocument();
  expect(screen.queryByText(/Invalid Mini reads archive/)).not.toBeInTheDocument();
});

describe('DM-32UV debug page', () => {
  const history = getDebugReadHistory({ slug: 'dm-32uv', archiveModelId: 'DM-32UV' });
  afterEach(() => act(() => history.clear()));

  it('mounts one Calibration panel from the selected read, with no overlay select', async () => {
    const first = await archiveDm32Capture(dm32CalibrationCapture());
    const second = await archiveDm32Capture(
      dm32CalibrationCapture({
        calibrationAddress: 0x4000,
        window: { start: 0x1000, end: 0x4000 },
        rawRange: { start: 0x1000, end: 0x4fff },
      }),
    );
    let firstId = '';
    act(() => {
      firstId = history.add(first).id;
      history.add(second);
    });
    open('dm-32uv');
    fireEvent.click(screen.getByRole('tab', { name: 'Calibration' }));
    expect(screen.queryByText('Calibration unavailable')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Calibration overlay')).not.toBeInTheDocument();
    expect(screen.getByText('Not validated on hardware')).toBeInTheDocument();
    // The newest retained read is selected: its relocated page address shows.
    expect(screen.getByText('0x00004000')).toBeInTheDocument();
    act(() => history.select(firstId));
    expect(screen.getByText('0x00002000')).toBeInTheDocument();
    expect(screen.queryByText('0x00004000')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Trace' }));
    expect(screen.getByText('Trace unavailable')).toBeInTheDocument();
  });

  it('says Not captured on the Calibration tab before any read', () => {
    open('dm-32uv');
    fireEvent.click(screen.getByRole('tab', { name: 'Calibration' }));
    expect(
      screen.getByText('Open or read a capture to inspect its calibration.'),
    ).toBeInTheDocument();
  });

  it('mounts the DM-32 Memory viewer, asking for a capture before any read', () => {
    open('dm-32uv');
    fireEvent.click(screen.getByRole('tab', { name: 'Memory' }));
    expect(screen.getByText('Open or read a capture to inspect its memory.')).toBeInTheDocument();
  });

  it('retains a successful result that arrives after unmount', async () => {
    const archive = await archiveDm32Capture(dm32Capture());
    let finish!: (value: typeof archive) => void;
    fake.dm32.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = open('dm-32uv');
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    view.unmount();
    await act(async () => finish(archive));
    expect(history.getSnapshot().entries).toHaveLength(1);
    open('dm-32uv');
    expect(screen.getByText(/Live read · captured 2026-01-01/)).toBeInTheDocument();
  });

  it('retains three successful reads with labels', async () => {
    history.clear();
    const archive = await archiveDm32Capture(dm32Capture());
    fake.dm32.mockResolvedValueOnce(archive).mockResolvedValueOnce(archive);
    let finish!: (value: typeof archive) => void;
    fake.dm32.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    open('dm-32uv');
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    await waitFor(() => expect(history.getSnapshot().entries).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    await waitFor(() => expect(history.getSnapshot().entries).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    await screen.findByRole('button', { name: 'Cancel' });
    await act(async () => finish(archive));
    expect(history.getSnapshot().entries.map((e) => e.label)).toEqual(['A', 'B', 'C']);
    expect(history.getSnapshot().undownloaded).toBe(3);
  });

  it('reads the radio and shows captured identity evidence and coverage', async () => {
    fake.dm32.mockResolvedValueOnce(await archiveDm32Capture(dm32Capture()));
    open('dm-32uv');
    expect(screen.getByText(/no END command on this radio/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    expect(await screen.findByText(/Live read · captured/)).toBeInTheDocument();
    expect(screen.getByText('0x00001000 · captured · tag 0x12 (channel)')).toBeInTheDocument();
    expect(
      screen.getByText('0x00002000 · discovered, not read · tag 0x03 (unknown)'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Factory sector · program flash, separate address space'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(screen.getByText('DP570UV')).toBeInTheDocument();
    expect(screen.getAllByText('DM32.SYN.001').length).toBeGreaterThan(0);
    expect(screen.getByText('None observed')).toBeInTheDocument();
    // The Calibration panel is mounted too and repeats the chip UID, also labelled as not a serial.
    expect(screen.getAllByText('0xA0A1A2A3A4A5A6A7A8A9AAAB').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/not a serial/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unknown')).toHaveLength(2);
    expect(screen.getAllByTitle('Available')[0]).toHaveTextContent('Available');
  });

  it.each([
    ['fails', () => fake.dm32.mockRejectedValueOnce(new Error('Synthetic DM-32 failure'))],
    [
      'is cancelled',
      () =>
        fake.dm32.mockImplementationOnce(
          ({ signal }: { signal: AbortSignal }) =>
            new Promise((_resolve, reject) =>
              signal.addEventListener('abort', () => reject(new Error('Cancelled'))),
            ),
        ),
    ],
  ])('keeps the current archive when a replacement read %s', async (name, arrange) => {
    fake.dm32.mockResolvedValueOnce(await archiveDm32Capture(dm32Capture()));
    open('dm-32uv');
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    await screen.findByText(/Live read · captured 2026-01-01/);
    arrange();
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    if (name === 'is cancelled')
      fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(
      await screen.findByText(name === 'fails' ? 'Synthetic DM-32 failure' : 'Cancelled'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Live read · captured 2026-01-01/)).toBeInTheDocument();
    expect(screen.getByText('0x00001000 · captured · tag 0x12 (channel)')).toBeInTheDocument();
  });

  const zipFile = (bytes: Uint8Array) => {
    const file = new File([Uint8Array.from(bytes)], 'x.zip');
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => Uint8Array.from(bytes).buffer,
    });
    return file;
  };
  const dm32Descriptor = { slug: 'dm-32uv', archiveModelId: 'DM-32UV' };
  const addTwo = async () => {
    const archive = await archiveDm32Capture(dm32Capture());
    const later = await archiveDm32Capture({
      ...dm32Capture(),
      capturedAt: '2026-02-01T00:00:00.000Z',
    });
    return [history.add(archive), history.add(later)] as const;
  };

  it('marks only the selected read that a single download started with', async () => {
    const [first, second] = await addTwo();
    let finish!: (value: { status: 'saved' }) => void;
    vi.mocked(downloadZip).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    history.select(first.id);
    open('dm-32uv');
    fireEvent.click(screen.getByRole('button', { name: 'Download archive' }));
    act(() => history.select(second.id));
    await act(async () => finish({ status: 'saved' }));
    expect(history.getSnapshot().undownloaded).toBe(1);
    expect(history.getSnapshot().selectedId).toBe(second.id);
  });

  it('keeps a read undownloaded when a single download fails', async () => {
    await addTwo();
    vi.mocked(downloadZip).mockResolvedValueOnce({ status: 'failed' } as never);
    open('dm-32uv');
    fireEvent.click(screen.getByRole('button', { name: 'Download archive' }));
    expect(await screen.findByText('Download failed.')).toBeInTheDocument();
    expect(history.getSnapshot().undownloaded).toBe(2);
  });

  it('cannot mark a read added after clear when an earlier download completes', async () => {
    await addTwo();
    const extra = await archiveDm32Capture(dm32Capture());
    let finish!: (value: { status: 'saved' }) => void;
    vi.mocked(downloadZip).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    open('dm-32uv');
    fireEvent.click(screen.getByRole('button', { name: 'Download all reads' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear history' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Clear$/ }));
    expect(history.getSnapshot().entries).toHaveLength(0);
    act(() => {
      history.add(extra);
    });
    await act(async () => finish({ status: 'saved' }));
    expect(history.getSnapshot().undownloaded).toBe(1);
    expect(history.getSnapshot().entries[0]?.label).toBe('A');
  });

  it('reopens a downloaded history ZIP with file provenance, original bytes and times', async () => {
    const [first, second] = await addTwo();
    const zip = buildDebugReadHistoryZip(dm32Descriptor, [first, second]);
    const original = [first, second].map((e) => e.archive.zipBytes);
    act(() => history.clear());
    open('dm-32uv');
    const input = document.querySelector('input[type="file"]');
    fireEvent.change(input!, { target: { files: [zipFile(zip)] } });
    await waitFor(() => expect(history.getSnapshot().entries).toHaveLength(2));
    const snap = history.getSnapshot();
    expect(snap.entries.map((e) => e.archive.zipBytes)).toEqual(original);
    expect(snap.entries.map((e) => e.readAt)).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
    ]);
    expect(snap.entries.every((e) => e.archive.source === 'file')).toBe(true);
    expect(snap.undownloaded).toBe(0);
    expect(snap.selectedId).toBe(snap.entries[1]!.id);
  });

  it('refuses a corrupt or wrong-profile history ZIP and keeps existing reads', async () => {
    const [first] = await addTwo();
    const zip = buildDebugReadHistoryZip(dm32Descriptor, [first]);
    const files = unzipSync(zip);
    files['reads/000001.zip'] = new Uint8Array([1, 2, 3]);
    open('dm-32uv');
    const input = document.querySelector('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [zipFile(zipSync(files))] } });
    expect(await screen.findByText('Operation failed')).toBeInTheDocument();
    expect(history.getSnapshot().entries).toHaveLength(2);
    const d890 = exampleArchive();
    const wrong = buildDebugReadHistoryZip({ slug: 'at-d890uv', archiveModelId: 'AT-D890UV' }, [
      { id: 'x', label: 'A', readAt: d890.manifest.capturedAt, archive: d890 },
    ]);
    fireEvent.change(input, { target: { files: [zipFile(wrong)] } });
    expect(await screen.findByText(/does not match this profile/)).toBeInTheDocument();
    expect(history.getSnapshot().entries).toHaveLength(2);
  });

  it('compares two DM-32 reads through the Compare tab and resets on clear', async () => {
    const a = await archiveDm32Capture(dm32Capture());
    const withBuild = dm32Capture();
    withBuild.capturedAt = '2026-02-01T00:00:00.000Z';
    withBuild.vframes = [
      ...withBuild.vframes,
      { id: 0x03, status: 'ok', payload: new TextEncoder().encode('20260202') },
    ];
    const b = await archiveDm32Capture(withBuild);
    const [first, second] = [history.add(a), history.add(b)];
    history.select(first.id);
    open('dm-32uv');
    fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));
    // Previous vs latest by default: A against B.
    expect(screen.getByRole('combobox', { name: 'Compare B' })).toHaveDisplayValue(/^B ·/);
    expect(await screen.findByText('Decoded changes')).toBeInTheDocument();
    // Only changes is on: the unchanged model is not listed; the build date is not captured in A.
    expect(screen.queryByText('Identity / Model')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('switch', { name: 'Only changes' }));
    expect(screen.getByText('Identity / Build date')).toBeInTheDocument();
    expect(screen.getAllByText('Not captured').length).toBeGreaterThan(0);
    // Selecting the other read updates Overview and Coverage.
    act(() => history.select(second.id));
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(screen.getByText('20260202')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Backup' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clear history' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Clear$/ }));
    fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));
    expect(screen.getByText('Read or open a second capture to compare.')).toBeInTheDocument();
    expect(screen.queryByText(/Identity \/ Model/)).not.toBeInTheDocument();
  });

  it('keeps DM-32 history isolated from other profiles', async () => {
    const rt95 = getDebugReadHistory({ slug: 'rt95', archiveModelId: 'retevis-rt95' });
    rt95.clear();
    await addTwo();
    expect(rt95.getSnapshot().entries).toHaveLength(0);
    expect(rt95.getSnapshot().undownloaded).toBe(0);
  });

  it('leaves the RadioFoundry profile without a live read', () => {
    open('dm-32uv-radiofoundry');
    expect(screen.queryByRole('button', { name: 'Read radio' })).not.toBeInTheDocument();
  });
});

it('keeps the direct RT95 calibration route behind the production debug gate', async () => {
  fake.prod = true;
  localStorage.removeItem(DEVELOPER_MODE_KEY);
  const router = createMemoryRouter([gatedDebugRoute, { path: '/', element: <div>Home</div> }], {
    initialEntries: ['/debug/radios/rt95'],
  });
  const view = render(
    <DesignSystemV2Provider>
      <RouterProvider router={router} />
    </DesignSystemV2Provider>,
  );
  expect(await screen.findByText('Home')).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/');
  view.unmount();
  localStorage.setItem(DEVELOPER_MODE_KEY, 'on');
  const allowed = createMemoryRouter([gatedDebugRoute, { path: '/', element: <div>Home</div> }], {
    initialEntries: ['/debug/radios/rt95'],
  });
  render(
    <DesignSystemV2Provider>
      <RouterProvider router={allowed} />
    </DesignSystemV2Provider>,
  );
  fireEvent.click(await screen.findByRole('tab', { name: 'Calibration' }));
  expect(screen.getByText('Calibration and production record [body]')).toBeInTheDocument();
  fake.prod = false;
  localStorage.removeItem(DEVELOPER_MODE_KEY);
});

it('shows RT95 head and unknown provenance and has no write or restore buttons on any tab', async () => {
  open('rt95');
  fireEvent.change(document.querySelector('input[type="file"]')!, {
    target: { files: [rt95ArchiveFile()] },
  });
  await screen.findByText(/Local archive · captured/);
  for (const name of ['Overview', 'Backup', 'Calibration', 'Memory', 'Hex', 'Compare']) {
    const tab = screen.queryByRole('tab', { name });
    if (!tab) throw new Error(`Missing ${name} tab`);
    fireEvent.click(tab);
    expect(screen.queryByRole('button', { name: /write|restore/i })).not.toBeInTheDocument();
    if (name === 'Overview') {
      expect(screen.getByText('PC ident [head]').parentElement).toHaveTextContent('12 34 ab cd');
      expect(screen.getByText('Clone channels/settings [unknown]')).toBeInTheDocument();
      expect(screen.getByText('Expected family')).toBeInTheDocument();
      expect(screen.getByText('Serial · archive').parentElement).toHaveTextContent(
        'SYNTHETIC-SERIAL-123456789',
      );
      expect(screen.getByText('Firmware · archive').parentElement).toHaveTextContent(
        'archive-version',
      );
      expect(screen.getByText('Evidence').parentElement).toHaveTextContent('Archive manifest');
      expect(screen.getByText('Connection').parentElement).toHaveTextContent('Not connected');
    }
  }
});

it('shows the entire serial supplied by an archive for a profile that exposes it', async () => {
  const serial = 'SYNTHETIC-SERIAL-123456789';
  const zip = packRadioBackupZip(
    {
      format: 'codeplug-studio-radio-backup',
      version: 1,
      capturedAt: '2026-01-01',
      capturedVia: 'file',
      app: { buildEnv: 'test', buildVersion: 'test' },
      radioModelId: 'UV-5R Mini',
      descriptorLabel: 'test',
      coverage: 'partial',
      imageByteLength: 1,
      serial,
      regions: [
        {
          id: 'other',
          label: 'Other',
          address: 0,
          byteLength: 1,
          path: 'regions/other.bin',
          restoreRole: 'inspect-only',
        },
      ],
    },
    { other: new Uint8Array(1) },
  );
  const file = new File([Uint8Array.from(zip)], 'serial.zip');
  Object.defineProperty(file, 'arrayBuffer', { value: async () => Uint8Array.from(zip).buffer });
  open();
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
  await screen.findByText(/Local archive · captured/);
  fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
  expect(screen.getByText('Serial · archive').parentElement).toHaveTextContent(serial);
});

it.each([
  ['missing', 'Not captured'],
  ['partial', 'Partially captured in programming image'],
  ['captured', 'Captured in programming image'],
] as const)('reports %s RT95 programming image coverage on Overview', async (kind, expected) => {
  open('rt95');
  fireEvent.change(document.querySelector('input[type="file"]')!, {
    target: { files: [rt95ArchiveFile(kind)] },
  });
  await screen.findByText(/Local archive · captured/);
  fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
  expect(screen.getByText('Clone channels/settings [unknown]').parentElement).toHaveTextContent(
    expected,
  );
});

it('retains comparison uploads in shared history for other viewers and download all', async () => {
  const descriptor = { slug: 'uv-5r-mini', archiveModelId: 'UV-5R Mini' };
  const history = getDebugReadHistory(descriptor);
  history.clear();
  vi.mocked(downloadZip).mockClear();
  const legacy = new Uv5rMiniDebugReadStore();
  legacy.add(syntheticRead(1), new Date('2024-01-01T12:00:00Z'));
  legacy.add(syntheticRead(2), new Date('2024-01-02T12:00:00Z'));
  const bytes = buildUv5rMiniReadsZip(legacy.getSnapshot().reads);
  const file = new File([Uint8Array.from(bytes)], 'reads.zip');
  Object.defineProperty(file, 'arrayBuffer', { value: async () => Uint8Array.from(bytes).buffer });
  const page = render(
    <MemoryRouter initialEntries={['/debug/radios/uv-5r-mini']}>
      <DesignSystemV2Provider>
        <Routes>
          <Route path="/debug/radios/:radio" element={<RadioDebugPage />} />
        </Routes>
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));
  const inputs = document.querySelectorAll('input[type="file"]');
  fireEvent.change(inputs[inputs.length - 1]!, { target: { files: [file] } });
  await waitFor(() => expect(history.getSnapshot().entries).toHaveLength(2));
  expect(screen.getByRole('combobox', { name: 'Compare B' })).toHaveDisplayValue(/^B ·/);
  fireEvent.click(screen.getByRole('tab', { name: 'Calibration' }));
  expect(screen.getByRole('combobox', { name: 'Read' })).toHaveDisplayValue(/File B/);
  fireEvent.click(screen.getByRole('tab', { name: 'Backup' }));
  fireEvent.click(screen.getByRole('button', { name: 'Download all reads' }));
  await waitFor(() => expect(downloadZip).toHaveBeenCalled());
  const zip = vi.mocked(downloadZip).mock.calls[0]![0];
  expect(openDebugReadHistoryZip(zip, descriptor)).toHaveLength(2);
  page.unmount();
  open();
  expect(screen.getByText(/Reads in this tab:/)).toHaveTextContent('File B');
  act(() => history.clear());
}, 15000);

const OG77_PAGES: [string, string, number[]][] = [
  ['dm-1701-opengd77', OPENGD77_DM1701_MODEL_ID, [0x08, 0x0a]],
  ['md-9600-opengd77', OPENGD77_MD9600_MODEL_ID, [0x05]],
];

function zipFile(bytes: Uint8Array) {
  const file = new File([Uint8Array.from(bytes)], 'capture.zip');
  Object.defineProperty(file, 'arrayBuffer', { value: async () => Uint8Array.from(bytes).buffer });
  return file;
}

describe.each(OG77_PAGES)('OpenGD77 debug page %s', (slug, modelId, radioTypes) => {
  const history = getDebugReadHistory({
    slug,
    archiveModelId: slug.startsWith('dm') ? 'DM-1701' : 'MD-9600',
  });
  const otherSlug = slug === 'dm-1701-opengd77' ? 'md-9600-opengd77' : 'dm-1701-opengd77';
  const otherHistory = getDebugReadHistory({
    slug: otherSlug,
    archiveModelId: otherSlug.startsWith('dm') ? 'DM-1701' : 'MD-9600',
  });
  afterEach(() =>
    act(() => {
      history.clear();
      otherHistory.clear();
    }),
  );
  const addTwo = async () => {
    const a = await syntheticOpenGd77Archive(modelId, { revision: 'R20240101000000' });
    const b = await syntheticOpenGd77Archive(modelId, {
      revision: 'R20250505000000',
      capturedAt: '2026-02-01T00:00:00.000Z',
      userDatabaseEntries: 3,
    });
    return [history.add(a), history.add(b)] as const;
  };
  const descriptor = { slug, archiveModelId: slug.startsWith('dm') ? 'DM-1701' : 'MD-9600' };

  it('keeps a live read in history, labelled, selected and undownloaded, isolated per page', async () => {
    fake.pipe = new OpenGd77ScriptedPipe(radioTypes[0]);
    open(slug);
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    await screen.findByText(/Live read · captured/, {}, { timeout: 20000 });
    const snap = history.getSnapshot();
    expect(snap.entries.map((e) => e.label)).toEqual(['A']);
    expect(snap.selectedId).toBe(snap.entries[0]!.id);
    expect(snap.undownloaded).toBe(1);
    expect(otherHistory.getSnapshot().entries).toHaveLength(0);
    expect(
      getDebugReadHistory({ slug: 'dm-32uv', archiveModelId: 'DM-32UV' }).getSnapshot().entries,
    ).toHaveLength(0);
  }, 30000);

  it('retains a successful read that arrives after unmount and shows it on return', async () => {
    const archive = await syntheticOpenGd77Archive(modelId);
    const entry = radioDebugDescriptors.find((d) => d.slug === slug)!;
    const original = entry.capture;
    let finish!: (value: typeof archive) => void;
    entry.capture = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    try {
      const view = open(slug);
      fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
      view.unmount();
      await act(async () => finish(archive));
      expect(history.getSnapshot().entries).toHaveLength(1);
      open(slug);
      expect(screen.getByText(/Live read · captured/)).toBeInTheDocument();
    } finally {
      entry.capture = original;
    }
  });

  it('marks only the read a download started with, and keeps it undownloaded on failure', async () => {
    const [first, second] = await addTwo();
    let finish!: (value: { status: 'saved' }) => void;
    vi.mocked(downloadZip).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    history.select(first.id);
    open(slug);
    fireEvent.click(screen.getByRole('button', { name: 'Download archive' }));
    act(() => history.select(second.id));
    await act(async () => finish({ status: 'saved' }));
    expect(history.getSnapshot().undownloaded).toBe(1);
    vi.mocked(downloadZip).mockResolvedValueOnce({ status: 'failed' } as never);
    fireEvent.click(screen.getByRole('button', { name: 'Download archive' }));
    expect(await screen.findByText('Download failed.')).toBeInTheDocument();
    expect(history.getSnapshot().undownloaded).toBe(1);
  });

  it('Download all marks every read; Clear needs confirmation', async () => {
    await addTwo();
    open(slug);
    fireEvent.click(screen.getByRole('button', { name: 'Download all reads' }));
    await waitFor(() => expect(history.getSnapshot().undownloaded).toBe(0));
    fireEvent.click(screen.getByRole('button', { name: 'Clear history' }));
    expect(history.getSnapshot().entries).toHaveLength(2);
    fireEvent.click(await screen.findByRole('button', { name: /^Clear$/ }));
    expect(history.getSnapshot().entries).toHaveLength(0);
    expect(history.getSnapshot().selectedId).toBeNull();
    expect(history.getSnapshot().compareId).toBeNull();
  });

  it('reopens a history ZIP and refuses a corrupt, wrong-profile or wrong-model one', async () => {
    const [first, second] = await addTwo();
    const zip = buildDebugReadHistoryZip(descriptor, [first, second]);
    const original = [first, second].map((e) => e.archive.zipBytes);
    act(() => history.clear());
    open(slug);
    const input = () => document.querySelector('input[type="file"]')!;
    fireEvent.change(input(), { target: { files: [zipFile(zip)] } });
    await waitFor(() => expect(history.getSnapshot().entries).toHaveLength(2));
    const snap = history.getSnapshot();
    expect(snap.entries.map((e) => e.archive.zipBytes)).toEqual(original);
    expect(snap.entries.map((e) => e.readAt)).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
    ]);
    expect(snap.entries.every((e) => e.archive.source === 'file')).toBe(true);
    expect(snap.undownloaded).toBe(0);
    const files = unzipSync(zip);
    files['reads/000001.zip'] = new Uint8Array([1, 2, 3]);
    fireEvent.change(input(), { target: { files: [zipFile(zipSync(files))] } });
    expect(await screen.findByText('Operation failed')).toBeInTheDocument();
    const otherDescriptor = {
      slug: otherSlug,
      archiveModelId: otherSlug.startsWith('dm') ? 'DM-1701' : 'MD-9600',
    };
    const wrong = buildDebugReadHistoryZip(otherDescriptor, [first, second]);
    fireEvent.change(input(), { target: { files: [zipFile(wrong)] } });
    expect(await screen.findByText(/does not match this profile/)).toBeInTheDocument();
    const wrongModel = await syntheticOpenGd77Archive(
      modelId === OPENGD77_DM1701_MODEL_ID ? OPENGD77_MD9600_MODEL_ID : OPENGD77_DM1701_MODEL_ID,
    );
    fireEvent.change(input(), { target: { files: [zipFile(wrongModel.zipBytes)] } });
    expect(await screen.findByText(/does not match this profile/)).toBeInTheDocument();
    expect(history.getSnapshot().entries).toHaveLength(2);
    // A plain single archive opens on the same control.
    const plain = await syntheticOpenGd77Archive(modelId, {
      capturedAt: '2026-03-01T00:00:00.000Z',
    });
    fireEvent.change(input(), { target: { files: [zipFile(plain.zipBytes)] } });
    await waitFor(() => expect(history.getSnapshot().entries).toHaveLength(3));
  });

  it('compares two reads: byte summary, decoded evidence', async () => {
    const [first] = await addTwo();
    history.select(first.id);
    open(slug);
    fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));
    expect(screen.getByRole('combobox', { name: 'Compare B' })).toHaveDisplayValue(/^B ·/);
    const identity = await screen.findByRole('group', { name: 'Identity' });
    expect(identity).toHaveTextContent('changed');
    expect(identity).toHaveTextContent('Revision');
    const userDb = screen.getByRole('group', { name: 'User Database' });
    expect(userDb).toHaveTextContent('Entry count (header)');
    expect(userDb).toHaveTextContent('23');
    expect(screen.getByText('A and B differ')).toBeInTheDocument();
    expect(screen.getByText('27 bytes on one side only')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Show User Database.* in the hex diff/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Decoded changes are unavailable/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Responding unit/)).not.toBeInTheDocument();
  });

  it('shows Unavailable for an invalid FirmwareInfo sidecar', async () => {
    const [first] = await addTwo();
    const base = await syntheticOpenGd77Archive(modelId, {
      capturedAt: '2026-04-01T00:00:00.000Z',
    });
    const [bad] = history.importArchives([
      openDebugArchive(
        packRadioBackupZip(base.manifest, base.regions, {
          [OPENGD77_DEBUG_FIRMWARE_INFO_SIDECAR]: new Uint8Array(10),
        }),
        modelId,
      ),
    ]);
    history.select(first.id);
    history.setComparePair({ a: first.id, b: bad.id });
    open(slug);
    fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));
    expect(await screen.findByText(/Invalid FirmwareInfo/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/null/);
  });

  it.each(radioTypes)(
    'reads through the guard and shows identity (radio type %i)',
    async (radioType) => {
      const pipe = new OpenGd77ScriptedPipe(radioType);
      fake.pipe = pipe;
      open(slug);
      expect(screen.getByText('Read-only capture and recovery')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
      expect(
        await screen.findByText(/Live read · captured/, {}, { timeout: 20000 }),
      ).toBeInTheDocument();
      expect(pipe.writes.length).toBeGreaterThan(100);
      for (const frame of pipe.writes) {
        expect(classifyOpenGd77DebugFrame(frame).allowed).toBe(true);
        expect([0x58, 0x57, 0x44]).not.toContain(frame[0]);
      }
      expect(pipe.controls).toEqual([]);
      expect(pipe.commands).toEqual([[0xfe], [0x00], [0x05]]);
      fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
      const hex = radioType.toString(16).padStart(2, '0');
      expect(screen.getByText(new RegExp(`^0x${hex} · `))).toBeInTheDocument();
      expect(screen.getByText('Revision · FirmwareInfo (as reported)')).toBeInTheDocument();
      expect(screen.getByText('R20240101000000')).toBeInTheDocument();
      expect(screen.getByText('None reported by FirmwareInfo')).toBeInTheDocument();
      expect(screen.getAllByText('Unknown').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Captured FirmwareInfo reply')).toBeInTheDocument();
      expect(screen.getByText('Read complete · disconnected')).toBeInTheDocument();
      expect(
        screen.getByText(/Radio type does not distinguish DM-1701 from RT-84/),
      ).toBeInTheDocument();
      for (const badge of screen.getAllByTitle('Available')) expect(badge).toBeInTheDocument();
      expect(screen.queryAllByTitle('Not yet available')).toHaveLength(0);
      expect(screen.getAllByTitle('Partial')).toHaveLength(2);
      expect(screen.queryByRole('button', { name: /write|restore/i })).not.toBeInTheDocument();
    },
    30000,
  );

  it('refuses a radio of the other model before the CPS screen and keeps the page', async () => {
    const wrong = modelId === OPENGD77_DM1701_MODEL_ID ? 0x05 : 0x08;
    const pipe = new OpenGd77ScriptedPipe(wrong);
    fake.pipe = pipe;
    open(slug);
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    expect(
      await screen.findByText(new RegExp(`radioType 0x${wrong.toString(16)} is not supported`)),
    ).toBeInTheDocument();
    expect(pipe.commands).toEqual([[0xfe]]);
    expect(screen.queryByText(/Live read · captured/)).not.toBeInTheDocument();
  });

  it('keeps the current archive when a later read fails', async () => {
    const archive = await syntheticOpenGd77Archive(modelId, {
      capturedAt: '2026-02-02T00:00:00.000Z',
    });
    open(slug);
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [zipFile(archive.zipBytes)] },
    });
    await screen.findByText(/Local archive · captured 2026-02-02/);
    const pipe = new OpenGd77ScriptedPipe(radioTypes[0]);
    pipe.failReadsAt.add(0x80 + 32 * 3);
    fake.pipe = pipe;
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    expect(await screen.findByText('Operation failed')).toBeInTheDocument();
    expect(screen.getByText(/Local archive · captured 2026-02-02/)).toBeInTheDocument();
    expect(pipe.commands).toEqual([[0xfe], [0x00], [0x05]]);
  });

  it('cancel sends only the CPS close and shows no archive', async () => {
    const pipe = new OpenGd77ScriptedPipe(radioTypes[0]);
    const original = pipe.write.bind(pipe);
    let reads = 0;
    pipe.write = async (data: Uint8Array) => {
      if (data[0] === 0x52 && data[1] === 0x01 && ++reads === 3) {
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      }
      return original(data);
    };
    fake.pipe = pipe;
    open(slug);
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    expect(await screen.findByText('Operation failed')).toBeInTheDocument();
    expect(pipe.commands).toEqual([[0xfe], [0x00], [0x05]]);
    expect(screen.queryByText(/Live read · captured/)).not.toBeInTheDocument();
  });

  it('opens its own archive offline with the same identity and coverage', async () => {
    const archive = await syntheticOpenGd77Archive(modelId, { userDatabaseEntries: 3 });
    open(slug);
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [zipFile(archive.zipBytes)] },
    });
    await screen.findByText(/Local archive · captured/);
    expect(screen.getByText('Registered FLASH spans')).toBeInTheDocument();
    expect(screen.getAllByText(/Captured$/)).toHaveLength(4);
    expect(screen.getByText(/packed header \+ entries, not contiguous flash/)).toBeInTheDocument();
    expect(screen.getByText(/not a full flash image or a firmware dump/)).toBeInTheDocument();
    expect(screen.getByText(/Flash ID 0x4018 \(as reported\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(screen.getByText('Captured FirmwareInfo reply')).toBeInTheDocument();
    expect(screen.getByText('Not connected')).toBeInTheDocument();
  });

  it('refuses the other model archive', async () => {
    const other =
      modelId === OPENGD77_DM1701_MODEL_ID ? OPENGD77_MD9600_MODEL_ID : OPENGD77_DM1701_MODEL_ID;
    const archive = await syntheticOpenGd77Archive(other);
    open(slug);
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [zipFile(archive.zipBytes)] },
    });
    expect(await screen.findByText(/does not match this profile/)).toBeInTheDocument();
  });

  it('says a missing or invalid FirmwareInfo sidecar is not identity', async () => {
    const archive = await syntheticOpenGd77Archive(modelId);
    const bare = packRadioBackupZip(archive.manifest, archive.regions);
    open(slug);
    const input = () => document.querySelector('input[type="file"]')!;
    fireEvent.change(input(), { target: { files: [zipFile(bare)] } });
    await screen.findByText(/Local archive · captured/);
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(screen.getByText('Archive manifest only')).toBeInTheDocument();
    expect(screen.queryByText(/^0x0[0-9a-f] · /)).not.toBeInTheDocument();
    const invalid = packRadioBackupZip(archive.manifest, archive.regions, {
      [OPENGD77_DEBUG_FIRMWARE_INFO_SIDECAR]: new Uint8Array(10),
    });
    fireEvent.change(input(), { target: { files: [zipFile(invalid)] } });
    expect(await screen.findByText(/Invalid FirmwareInfo: .*10 bytes/)).toBeInTheDocument();
  });

  it('reports a partial archive in coverage', async () => {
    const archive = await syntheticOpenGd77Archive(modelId);
    const manifest = {
      ...archive.manifest,
      regions: archive.manifest.regions.filter((r) => r.id !== 'flash-span-1'),
    };
    const regions = { ...archive.regions };
    delete regions['flash-span-1'];
    open(slug);
    fireEvent.change(document.querySelector('input[type="file"]')!, {
      target: { files: [zipFile(packRadioBackupZip(manifest, regions, archive.sidecars))] },
    });
    expect(await screen.findByText(/Missing from this archive/)).toBeInTheDocument();
  });

  it('shows the Calibration tab as Partial with a viewer, not the unavailable alert', async () => {
    const [first, second] = await addTwo();
    history.select(second.id);
    void first;
    open(slug);
    fireEvent.click(screen.getByRole('tab', { name: 'Calibration' }));
    expect(screen.queryByText('Calibration unavailable')).not.toBeInTheDocument();
    expect(screen.getAllByText('Calibration overlay').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/not stock factory calibration/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Unknown bytes')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Trace' }));
    expect(screen.getByText('Trace unavailable')).toBeInTheDocument();
    const entry = radioDebugDescriptors.find((d) => d.slug === slug)!;
    expect(entry.capabilities).toEqual([
      { name: 'Backup', status: 'Available' },
      { name: 'Calibration', status: 'Partial' },
      { name: 'Memory', status: 'Partial' },
    ]);
  });

  it('routes Memory to the OpenGD77 viewer, with contacts, RX groups and the User Database', async () => {
    open(slug);
    fireEvent.click(screen.getByRole('tab', { name: 'Memory' }));
    expect(screen.getAllByText('No capture').length).toBeGreaterThan(0);
    history.add(await syntheticOpenGd77Archive(modelId));
    await screen.findByRole('combobox', { name: 'Category' });
    chooseCategory('Zones');
    chooseCategory('User Database');
    expect(screen.getByText('Valid header')).toBeInTheDocument();
    expect(screen.queryByText('Coming in a later piece')).not.toBeInTheDocument();
    chooseCategory('Contacts');
    expect(screen.getByText(/contact bank is captured and no slot is in use/)).toBeInTheDocument();
    chooseCategory('RX groups');
    expect(screen.getByText(/RX group bank is captured and no list is in use/)).toBeInTheDocument();
  });

  it('reads a Backup-style archive without the region as not captured', async () => {
    history.add(await syntheticOpenGd77Archive(modelId, { calibration: null }));
    open(slug);
    fireEvent.click(screen.getByRole('tab', { name: 'Calibration' }));
    expect(screen.getByText('Calibration not captured')).toBeInTheDocument();
  });

  it('a live read carries the calibration region and shows it', async () => {
    fake.pipe = new OpenGd77ScriptedPipe(radioTypes[0]);
    open(slug);
    fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
    await screen.findByText(/Live read · captured/, {}, { timeout: 20000 });
    fireEvent.click(screen.getByRole('tab', { name: 'Calibration' }));
    // Unplanted scripted flash reads 0xFF, so the marker is absent: raw only, no verdicts.
    expect(screen.getByText(/Marker absent/)).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
  }, 30000);
});

it('keeps the OpenGD77 pages behind the production debug gate', async () => {
  fake.prod = true;
  localStorage.removeItem(DEVELOPER_MODE_KEY);
  for (const [slug] of OG77_PAGES) {
    const router = createMemoryRouter([gatedDebugRoute, { path: '/', element: <div>Home</div> }], {
      initialEntries: [`/debug/radios/${slug}`],
    });
    const view = render(
      <DesignSystemV2Provider>
        <RouterProvider router={router} />
      </DesignSystemV2Provider>,
    );
    expect(await screen.findByText('Home')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(screen.queryByRole('button', { name: 'Read radio' })).not.toBeInTheDocument();
    view.unmount();
  }
  fake.prod = false;
});
