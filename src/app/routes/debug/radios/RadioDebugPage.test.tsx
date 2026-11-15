import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import {
  decodeUv5rMiniFullRead,
  hashUv5rMiniDebugSpans,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import { buildUv5rMiniReadsZip, Uv5rMiniDebugReadStore } from '../uv5rMiniDebugReads.ts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import RadioDebugPage from './RadioDebugPage.tsx';
import { gatedDebugRoute } from '../debugRoutes.tsx';
import { DEVELOPER_MODE_KEY } from '@integrations/preferences/developerMode.ts';
import { archiveDm32Capture } from './dm32Capture.ts';
import type { Dm32DebugCapture } from '@integrations/radio-io/radios/dm32uv/debugCapture.ts';

const fake = vi.hoisted(() => ({ run: vi.fn(), dm32: vi.fn(), prod: false }));
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
  render(
    <MemoryRouter initialEntries={[`/debug/radios/${slug}`]}>
      <DesignSystemV2Provider>
        <Routes>
          <Route path="/debug/radios/:radio" element={<RadioDebugPage />} />
        </Routes>
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Backup' }));
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
  fireEvent.click(screen.getByRole('combobox', { name: 'Second read' }));
  fireEvent.click(screen.getByRole('option', { name: /File A/ }));
  expect(screen.getByRole('combobox', { name: 'Second read' })).toHaveDisplayValue(/File A/);
  fireEvent.click(screen.getByRole('tab', { name: 'Backup' }));
  fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
  await screen.findByText(/Live read · captured/);
  fireEvent.click(screen.getByRole('tab', { name: 'Calibration' }));
  expect(screen.getByRole('combobox', { name: 'Read' })).toHaveDisplayValue(/Live/);
  fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));
  expect(screen.getByRole('combobox', { name: 'Second read' })).toHaveDisplayValue(/Live/);
}, 15000);

it('adds a successful live read to history with its timestamp', async () => {
  fake.run.mockResolvedValueOnce(syntheticRead(4));
  open();
  fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
  expect(await screen.findByText(/Reads in this tab:.*Live [A-Z]+ \(.+\)/)).toBeInTheDocument();
});

function rt95ArchiveFile() {
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
          id: 'a',
          label: 'A',
          address: 0,
          byteLength: 4,
          path: 'regions/a.bin',
          restoreRole: 'inspect-only',
        },
      ],
    },
    { a: new Uint8Array(4) },
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

function dm32Capture(): Dm32DebugCapture {
  const page = (tag: number) => {
    const data = new Uint8Array(4096);
    data[0xfff] = tag;
    return data;
  };
  return {
    capturedAt: '2026-01-01T00:00:00.000Z',
    modelString: 'DP570UV',
    factory: { status: 'not-kept', reason: 'mismatch' },
    vframes: [
      { id: 0x01, status: 'ok', payload: new TextEncoder().encode('DM32.SYN.001') },
      { id: 0x02, status: 'ok', payload: Uint8Array.from({ length: 12 }, (_, i) => i + 0xa0) },
      { id: 0x0a, status: 'ok', payload: new Uint8Array([0, 0x10, 0, 0, 0xff, 0x2f, 0, 0]) },
    ],
    rawRange: { start: 0x1000, end: 0x2fff },
    window: { start: 0x1000, end: 0x2000 },
    discovered: [
      { address: 0x1000, metadata: 0x12, type: 'channel' },
      { address: 0x2000, metadata: 0x03, type: 'unknown' },
    ],
    channelCount: 0,
    blocks: new Map([[0x1000, page(0x12)]]),
  };
}

describe('DM-32UV debug page', () => {
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
    expect(screen.getByText('DM32.SYN.001')).toBeInTheDocument();
    expect(screen.getByText('None observed')).toBeInTheDocument();
    expect(screen.getByText('0xA0A1A2A3A4A5A6A7A8A9AAAB')).toBeInTheDocument();
    expect(screen.getByText(/not a serial/)).toBeInTheDocument();
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
