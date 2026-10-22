import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';
import * as radioIo from '@integrations/radio-io';
import { getFirmwareUpdater } from '@integrations/radio-io';

import * as envGate from '../../services/firmwareFlashEnvGate.ts';
import * as flash from '../../services/firmwareFlash.ts';
import FirmwareFlasherPage, { FIRMWARE_UNAVAILABLE_ON_SITE } from './FirmwareFlasherPage.tsx';

vi.mock('@integrations/radio-io', async (importOriginal) => {
  const actual = await importOriginal<typeof radioIo>();
  return {
    ...actual,
    isWebSerialSupported: vi.fn(() => true),
    isCapacitorSerialSupported: vi.fn(() => false),
  };
});

vi.mock('../../services/firmwareFlashEnvGate.ts', () => ({
  listOfferedFirmwareUpdaters: vi.fn(),
}));

vi.mock('../../services/firmwareFlash.ts', () => ({
  filesToNamedBytes: vi.fn(async (files: File[]) =>
    files.map((f) => ({ name: f.name, bytes: new Uint8Array(1) })),
  ),
  verifyStockFiles: vi.fn(),
  prepareStockFlash: vi.fn(),
  grantFirmwarePort: vi.fn(),
  runFirmwareFlash: vi.fn(),
  formatFirmwareFlashSummary: vi.fn(() => 'SUMMARY TEXT'),
}));

vi.mock('../../state/useFormatBuilds.ts', () => ({
  useFormatBuilds: () => ({ projectId: null, builds: [], loading: false }),
}));

const DM32 = getFirmwareUpdater('baofeng-dm32uv')!;
const IMAGE = {
  radioId: 'baofeng-dm32uv',
  provenance: 'stock',
  stockVersion: DM32.stock.version,
  package: { radioId: 'baofeng-dm32uv', files: {} },
  sha256: { bin: 'cd'.repeat(32) },
  verifyHint: 'The radio boots to its normal screen.',
} as unknown as PreparedFirmwareImage;

function renderPage() {
  const router = createMemoryRouter([{ path: '/firmware', element: <FirmwareFlasherPage /> }], {
    initialEntries: ['/firmware'],
  });
  return render(<RouterProvider router={router} />);
}

const cont = () => fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

async function walkToFlashStep({ tickChecks = true } = {}) {
  renderPage();
  fireEvent.click(screen.getByRole('radio', { name: /Baofeng DM-32UV/ }));
  cont();
  expect(screen.getByText(/Stock firmware \(v1\.01\.048\)/)).toBeInTheDocument();
  cont();
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, {
    target: { files: [new File(['x'], 'stock.zip')] },
  });
  await screen.findByText(/verified/);
  cont();
  await screen.findByText(/Ready to flash/);
  cont();
  const checks = screen.getAllByRole('checkbox');
  expect(checks).toHaveLength(4);
  if (!tickChecks) return;
  for (const c of checks) fireEvent.click(c);
  cont();
  expect(screen.getByText(DM32.stock.bootloaderEntry.steps[0]!)).toBeInTheDocument();
  cont();
}

describe('FirmwareFlasherPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(envGate.listOfferedFirmwareUpdaters).mockReturnValue([DM32]);
    vi.mocked(radioIo.isWebSerialSupported).mockReturnValue(true);
    vi.mocked(radioIo.isCapacitorSerialSupported).mockReturnValue(false);
    vi.mocked(flash.verifyStockFiles).mockResolvedValue({
      descriptor: DM32.stock,
      package: { radioId: 'baofeng-dm32uv', files: {} },
      sha256: { bin: 'ab'.repeat(32) },
      via: 'zip',
      zipMismatchNoted: false,
    });
    vi.mocked(flash.prepareStockFlash).mockResolvedValue(IMAGE);
    vi.mocked(flash.grantFirmwarePort).mockResolvedValue({} as radioIo.SerialPortLike);
  });

  it('renders the radio card', () => {
    renderPage();
    expect(screen.getByRole('radio', { name: /Baofeng DM-32UV/ })).toHaveTextContent(
      DM32.stock.version,
    );
  });

  it('shows the unavailable message when nothing is offered', () => {
    vi.mocked(envGate.listOfferedFirmwareUpdaters).mockReturnValue([]);
    renderPage();
    expect(screen.getByText(FIRMWARE_UNAVAILABLE_ON_SITE)).toBeInTheDocument();
  });

  it('needs every preflight box ticked, including the risk acknowledgement', async () => {
    await walkToFlashStep({ tickChecks: false });
    expect(screen.getByText(/flash at your own risk/)).toBeInTheDocument();
    const continueButton = screen.getByRole('button', { name: 'Continue' });
    const checks = screen.getAllByRole('checkbox');
    for (const c of checks.slice(0, 3)) fireEvent.click(c);
    expect(continueButton).toBeDisabled();
    fireEvent.click(checks[3]!);
    expect(continueButton).not.toBeDisabled();
  });

  it('shows the done screen with the verify hint', async () => {
    vi.mocked(flash.runFirmwareFlash).mockResolvedValue({
      ok: true,
      radioId: 'baofeng-dm32uv',
      image: IMAGE,
      ident: { radioId: 'baofeng-dm32uv', model: 'M', raw: new Uint8Array(0) },
      result: { framesSent: 1, dataFrames: 1, elapsedMs: 1, end: 'eot-sent' },
      startedAt: 'now',
    });
    await walkToFlashStep();
    fireEvent.click(screen.getByRole('button', { name: 'Connect and flash' }));
    expect(await screen.findByText(/then check: The radio boots/)).toBeInTheDocument();
    expect(screen.getByTestId('firmware-flash-summary')).toHaveTextContent('SUMMARY TEXT');
  });

  it('shows the recovery screen after a failure that touched the radio', async () => {
    vi.mocked(flash.runFirmwareFlash).mockResolvedValue({
      ok: false,
      radioId: 'baofeng-dm32uv',
      image: IMAGE,
      code: 'timeout',
      message: 'The radio stopped answering.',
      position: 'block#57',
      radioTouched: true,
      startedAt: 'now',
    });
    await walkToFlashStep();
    fireEvent.click(screen.getByRole('button', { name: 'Connect and flash' }));
    expect(await screen.findByText(/Don't keep power-cycling the radio/)).toBeInTheDocument();
    expect(screen.queryByText(/Nothing was written/)).not.toBeInTheDocument();
  });

  it('says nothing was written after a failure before touch', async () => {
    vi.mocked(flash.runFirmwareFlash).mockResolvedValue({
      ok: false,
      radioId: 'baofeng-dm32uv',
      image: IMAGE,
      code: 'wrongIdent',
      message: 'Wrong model.',
      position: 'identify',
      radioTouched: false,
      startedAt: 'now',
    });
    await walkToFlashStep();
    fireEvent.click(screen.getByRole('button', { name: 'Connect and flash' }));
    expect(await screen.findByText(/Nothing was written/)).toBeInTheDocument();
  });

  it('asks before cancelling once the radio has been touched', async () => {
    vi.mocked(flash.runFirmwareFlash).mockImplementation(async (input) => {
      input.onProgress({
        cur: 10,
        max: 100,
        msg: 'Transfer 8/840',
        phase: 'transfer',
        radioTouched: true,
      });
      return new Promise((r) => {
        input.signal.addEventListener('abort', () =>
          r({
            ok: false,
            radioId: 'baofeng-dm32uv',
            image: IMAGE,
            code: 'aborted',
            message: 'Stopped.',
            position: 'block#8',
            radioTouched: true,
            startedAt: 'now',
          }),
        );
      });
    });
    await walkToFlashStep();
    fireEvent.click(screen.getByRole('button', { name: 'Connect and flash' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(
      await screen.findByText('Stopping now leaves the radio needing a re-flash.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(await screen.findByText(/Don't keep power-cycling the radio/)).toBeInTheDocument();
  });
});
