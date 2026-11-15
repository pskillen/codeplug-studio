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
  fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
  expect(screen.getByText('Not connected')).toBeInTheDocument();
});
