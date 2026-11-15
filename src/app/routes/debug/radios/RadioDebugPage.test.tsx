import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import {
  decodeUv5rMiniFullRead,
  hashUv5rMiniDebugSpans,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import { buildUv5rMiniReadsZip, Uv5rMiniDebugReadStore } from '../uv5rMiniDebugReads.ts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import RadioDebugPage from './RadioDebugPage.tsx';

const fake = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('@app/services/uv5rMiniDebugRead.ts', () => ({
  grantUv5rMiniDebugPort: vi.fn(async () => ({})),
  runUv5rMiniDebugFullRead: fake.run,
}));
function open() {
  render(
    <MemoryRouter initialEntries={['/debug/radios/uv-5r-mini']}>
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
