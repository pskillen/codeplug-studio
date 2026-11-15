import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import RadioDebugPage from './RadioDebugPage.tsx';

const fake = vi.hoisted(() => ({ capture: vi.fn() }));
vi.mock('./atD890Capture.ts', () => ({ captureAtD890: fake.capture }));

it('shows captured identity and retains an opened archive after a failed replacement', async () => {
  const local = new Uint8Array(0x40000);
  local.set(new TextEncoder().encode('SERIAL123456789'), 0x30);
  const ident = new Uint8Array(16);
  ident.set(new TextEncoder().encode('ID890UV'));
  ident[8] = 42;
  ident.set(new TextEncoder().encode('V100'), 9);
  const zip = packRadioBackupZip(
    {
      format: 'codeplug-studio-radio-backup',
      version: 1,
      capturedAt: '2026-01-01',
      capturedVia: 'file',
      app: { buildEnv: 'test', buildVersion: 'test' },
      radioModelId: 'AT-D890UV',
      descriptorLabel: 'test',
      coverage: 'partial',
      imageByteLength: 0x5000000,
      serial: 'MANIFEST-CLAIM',
      firmware: 'CLAIM',
      regions: [
        {
          id: 'vital-local-info',
          label: 'LocalInfo',
          address: 0x4f80000,
          byteLength: local.length,
          path: 'regions/local.bin',
          restoreRole: 'inspect-only',
        },
      ],
    },
    { 'vital-local-info': local },
    { 'debug/ident.bin': ident },
  );
  render(
    <MemoryRouter initialEntries={['/debug/radios/at-d890uv']}>
      <DesignSystemV2Provider>
        <Routes>
          <Route path="/debug/radios/:radio" element={<RadioDebugPage />} />
        </Routes>
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
  const file = new File([Uint8Array.from(zip)], 'capture.zip');
  Object.defineProperty(file, 'arrayBuffer', { value: async () => Uint8Array.from(zip).buffer });
  fireEvent.change(document.querySelector('input[type="file"]')!, { target: { files: [file] } });
  expect(await screen.findByText('SERIAL123456789')).toBeInTheDocument();
  expect(screen.getByText('ID890UV')).toBeInTheDocument();
  expect(screen.getByText('V100')).toBeInTheDocument();
  expect(screen.getByText('0x2A')).toBeInTheDocument();
  expect(screen.queryByText('MANIFEST-CLAIM')).not.toBeInTheDocument();
  expect(screen.queryByText('CLAIM')).not.toBeInTheDocument();
  expect(screen.getByText('Not connected')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: 'Backup' }));
  fake.capture.mockRejectedValueOnce(new Error('Synthetic failure'));
  fireEvent.click(screen.getByRole('button', { name: 'Read radio' }));
  expect(await screen.findByText('Synthetic failure')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Download archive' })).toBeInTheDocument();
  expect(screen.getByText(/as returned; not an independent physical copy/)).toBeInTheDocument();
});

it('offers keyboard-focusable capture and cancel controls at narrow width and returns to disconnected', async () => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
  fake.capture.mockImplementationOnce(
    ({ signal }: { signal: AbortSignal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener('abort', () => reject(new Error('Cancelled; power-cycle'))),
      ),
  );
  render(
    <MemoryRouter initialEntries={['/debug/radios/at-d890uv']}>
      <DesignSystemV2Provider>
        <Routes>
          <Route path="/debug/radios/:radio" element={<RadioDebugPage />} />
        </Routes>
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('tab', { name: 'Backup' }));
  const read = screen.getByRole('button', { name: 'Read radio' });
  read.focus();
  expect(read).toHaveFocus();
  fireEvent.click(read);
  const cancel = await screen.findByRole('button', { name: 'Cancel' });
  cancel.focus();
  expect(cancel).toHaveFocus();
  fireEvent.click(cancel);
  expect(await screen.findByText('Cancelled; power-cycle')).toBeInTheDocument();
  expect(screen.getByText(/profile · Not connected/)).toBeInTheDocument();
});

function d890Zip(capturedAt: string, trim: number | undefined) {
  const regions = [];
  const bytes: Record<string, Uint8Array> = {};
  if (trim !== undefined) {
    const tune = new Uint8Array(0x40);
    tune[0] = trim & 0xff;
    tune[1] = trim >> 8;
    regions.push({
      id: 'vital-tune-a',
      label: 'Calibration (live)',
      address: 0x4f00000,
      byteLength: tune.length,
      path: 'regions/tune-a.bin',
      restoreRole: 'inspect-only' as const,
    });
    bytes['vital-tune-a'] = tune;
  } else {
    regions.push({
      id: 'vital-tune-b',
      label: 'Calibration B (as returned)',
      address: 0x4f40000,
      byteLength: 16,
      path: 'regions/tune-b.bin',
      restoreRole: 'inspect-only' as const,
    });
    bytes['vital-tune-b'] = new Uint8Array(16).fill(0x07);
  }
  const zip = packRadioBackupZip(
    {
      format: 'codeplug-studio-radio-backup',
      version: 1,
      capturedAt,
      capturedVia: 'file',
      app: { buildEnv: 'test', buildVersion: 'test' },
      radioModelId: 'AT-D890UV',
      descriptorLabel: 'test',
      coverage: 'partial',
      imageByteLength: 0x5000000,
      regions,
    },
    bytes,
  );
  const file = new File([Uint8Array.from(zip)], `${capturedAt}.zip`);
  Object.defineProperty(file, 'arrayBuffer', { value: async () => Uint8Array.from(zip).buffer });
  return file;
}

const renderAt = (slug: string) =>
  render(
    <MemoryRouter initialEntries={[`/debug/radios/${slug}`]}>
      <DesignSystemV2Provider>
        <Routes>
          <Route path="/debug/radios/:radio" element={<RadioDebugPage />} />
        </Routes>
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );

it('shows one calibration panel that follows archive replacement without connecting', async () => {
  fake.capture.mockClear();
  renderAt('at-d890uv');
  fireEvent.click(screen.getByRole('tab', { name: 'Calibration' }));
  expect(screen.getByText('Open or read a capture to view calibration.')).toBeInTheDocument();
  expect(screen.queryByText('Calibration unavailable')).not.toBeInTheDocument();
  const input = () => document.querySelector('input[type="file"]')!;
  fireEvent.change(input(), { target: { files: [d890Zip('2026-02-01', 1800)] } });
  expect(await screen.findByText('1800')).toBeInTheDocument();
  expect(screen.getByText('Not validated on hardware')).toBeInTheDocument();
  fireEvent.change(input(), { target: { files: [d890Zip('2026-02-02', 2200)] } });
  expect(await screen.findByText('2200')).toBeInTheDocument();
  expect(screen.queryByText('1800')).not.toBeInTheDocument();
  fireEvent.change(input(), { target: { files: [d890Zip('2026-02-03', undefined)] } });
  expect(await screen.findByText(/This archive has no live tune unit/)).toBeInTheDocument();
  expect(
    screen.getByText(/Calibration B \(as returned\) is present but is not used/),
  ).toBeInTheDocument();
  expect(fake.capture).not.toHaveBeenCalled();
});

it('routes the D890 Memory tab to the memory viewer with a no-capture state', () => {
  renderAt('at-d890uv');
  fireEvent.click(screen.getByRole('tab', { name: 'Memory' }));
  expect(
    screen.getAllByText('Open or read a capture to inspect its memory.').length,
  ).toBeGreaterThan(0);
});

it('keeps the calibration panel unavailable for profiles without a decoder', () => {
  renderAt('rt95');
  fireEvent.click(screen.getByRole('tab', { name: 'Calibration' }));
  expect(screen.getByText('Calibration unavailable')).toBeInTheDocument();
});
