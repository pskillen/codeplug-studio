import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FirmwareError } from '@core/firmware/errors.ts';
import type {
  BundledFirmwareRelease,
  FirmwareReleaseSummary,
  LoadedFirmwarePatch,
} from '@core/firmware/releases/types.ts';
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
  prepareFlash: vi.fn(),
  listBundledReleases: vi.fn(),
  loadChosenPatch: vi.fn(),
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
  title: `stock firmware ${DM32.stock.version}`,
  package: { radioId: 'baofeng-dm32uv', files: {} },
  sha256: { bin: 'cd'.repeat(32) },
  verifyHint: 'The radio boots to its normal screen.',
} as unknown as PreparedFirmwareImage;

function release(tag: string, channel: 'final' | 'rc'): BundledFirmwareRelease {
  return {
    radioId: 'baofeng-dm32uv',
    tag,
    patchName: 'baofeng-dm32-firmware',
    channel,
    patchFile: `synthetic-${tag}.patch.json`,
    patchSha256: 'ee'.repeat(32),
    stockVersion: DM32.stock.version,
    publishedOn: '2026-01-01',
    summary: `Summary of ${tag}.`,
    verifyHint: `Release ${tag} verify hint.`,
    resultSha256: { bin: 'ff'.repeat(32) },
    loadBytes: async () => new Uint8Array(0),
    loadNotes: async () => `**What's in it**\n\n- Notes for ${tag}`,
  };
}

function summaryOf(r: BundledFirmwareRelease): FirmwareReleaseSummary {
  return {
    radioId: r.radioId,
    key: r.tag,
    label: r.tag,
    title: `MM9PDY modded firmware ${r.tag}`,
    channel: r.channel,
    provenance: 'bundled',
    release: r,
  };
}

const FINAL = summaryOf(release('1.0.0', 'final'));
const RC = summaryOf(release('1.1.0-rc.1', 'rc'));

function loadedFor(r: BundledFirmwareRelease): LoadedFirmwarePatch {
  return {
    bytes: new Uint8Array(0),
    sha256: r.patchSha256,
    parsed: { description: { version: r.tag } } as unknown as LoadedFirmwarePatch['parsed'],
    provenance: 'bundled',
    release: r,
  };
}

const UNREVIEWED: LoadedFirmwarePatch = {
  bytes: new Uint8Array(0),
  sha256: '12'.repeat(32),
  parsed: {
    description: { name: 'baofeng-dm32-firmware', version: '7.7.7' },
  } as unknown as LoadedFirmwarePatch['parsed'],
  provenance: 'unreviewed',
};

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
    vi.mocked(flash.prepareFlash).mockResolvedValue(IMAGE);
    vi.mocked(flash.listBundledReleases).mockImplementation(async (_radioId, includeRc) =>
      includeRc ? [FINAL, RC] : [FINAL],
    );
    vi.mocked(flash.loadChosenPatch).mockImplementation(async (_radioId, choice) =>
      choice.kind === 'release' ? loadedFor(choice.summary.release!) : UNREVIEWED,
    );
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

describe('FirmwareFlasherPage — releases and patch files', () => {
  async function toFirmwareStep() {
    renderPage();
    fireEvent.click(screen.getByRole('radio', { name: /Baofeng DM-32UV/ }));
    cont();
    await screen.findByText('Summary of 1.0.0.');
  }

  function dropPatch() {
    const input = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['{}'], 'mine.patch.json')] } });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(envGate.listOfferedFirmwareUpdaters).mockReturnValue([DM32]);
    vi.mocked(radioIo.isWebSerialSupported).mockReturnValue(true);
    vi.mocked(radioIo.isCapacitorSerialSupported).mockReturnValue(false);
    vi.mocked(flash.listBundledReleases).mockImplementation(async (_radioId, includeRc) =>
      includeRc ? [FINAL, RC] : [FINAL],
    );
    vi.mocked(flash.loadChosenPatch).mockImplementation(async (_radioId, choice) =>
      choice.kind === 'release' ? loadedFor(choice.summary.release!) : UNREVIEWED,
    );
  });

  it('lists finals, and adds release candidates on request', async () => {
    await toFirmwareStep();
    expect(
      screen.getByRole('radio', { name: /MM9PDY modded firmware 1\.0\.0/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/1\.1\.0-rc\.1/)).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Stock firmware/ })).toBeChecked();
    fireEvent.click(screen.getByText('Show release candidates'));
    const rc = await screen.findByRole('radio', { name: /MM9PDY modded firmware 1\.1\.0-rc\.1/ });
    expect(rc.closest('label')).toHaveTextContent('Pre-release');
  });

  it('expands the release notes', async () => {
    await toFirmwareStep();
    const details = screen.getAllByText('Release notes')[0]!.closest('details')!;
    details.open = true;
    fireEvent(details, new Event('toggle'));
    expect(await screen.findByText('Notes for 1.0.0')).toBeInTheDocument();
    expect(screen.getByText("What's in it").tagName).toBe('STRONG');
  });

  it('selects a bundled release and shows its verify hint when done', async () => {
    const image = {
      ...IMAGE,
      provenance: 'bundled',
      releaseTag: '1.0.0',
      title: 'MM9PDY modded firmware 1.0.0',
      versionStamp: '1.0.0',
      verifyHint: FINAL.release!.verifyHint,
    } as unknown as PreparedFirmwareImage;
    vi.mocked(flash.verifyStockFiles).mockResolvedValue({
      descriptor: DM32.stock,
      package: { radioId: 'baofeng-dm32uv', files: {} },
      sha256: { bin: 'ab'.repeat(32) },
      via: 'zip',
      zipMismatchNoted: false,
    });
    vi.mocked(flash.prepareFlash).mockResolvedValue(image);
    vi.mocked(flash.grantFirmwarePort).mockResolvedValue({} as radioIo.SerialPortLike);
    vi.mocked(flash.runFirmwareFlash).mockResolvedValue({
      ok: true,
      radioId: 'baofeng-dm32uv',
      image,
      ident: { radioId: 'baofeng-dm32uv', model: 'M', raw: new Uint8Array(0) },
      result: { framesSent: 1, dataFrames: 1, elapsedMs: 1, end: 'eot-sent' },
      startedAt: 'now',
    });
    await toFirmwareStep();
    fireEvent.click(screen.getByRole('radio', { name: /MM9PDY modded firmware 1\.0\.0/ }));
    await screen.findByRole('radio', { name: /MM9PDY modded firmware 1\.0\.0/, checked: true });
    cont();
    fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['x'], 'stock.zip')] },
    });
    await screen.findByText(/verified/);
    cont();
    expect(
      await screen.findByText(/MM9PDY modded firmware 1\.0\.0 \(bundled\)/),
    ).toBeInTheDocument();
    expect(screen.getByText('Version stamp: 1.0.0')).toBeInTheDocument();
    const [, , , last] = vi.mocked(flash.prepareFlash).mock.calls[0]!;
    expect(last?.release?.tag).toBe('1.0.0');
    cont();
    expect(
      screen.getByText(/You are flashing the MM9PDY modded firmware 1\.0\.0 to the/),
    ).toBeInTheDocument();
    for (const c of screen.getAllByRole('checkbox')) fireEvent.click(c);
    cont();
    cont();
    expect(
      screen.getByText(/Flashing the MM9PDY modded firmware 1\.0\.0 to the/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Connect and flash' }));
    expect(await screen.findByText(/Release 1\.0\.0 verify hint/)).toBeInTheDocument();
    expect(
      screen.getByText(/The MM9PDY modded firmware 1\.0\.0 is on the radio\./),
    ).toBeInTheDocument();
  });

  it('treats a dropped file identical to a bundled release as that release', async () => {
    vi.mocked(flash.loadChosenPatch).mockImplementation(async (_radioId, choice) =>
      choice.kind === 'user-patch' ? loadedFor(FINAL.release!) : loadedFor(FINAL.release!),
    );
    await toFirmwareStep();
    dropPatch();
    expect(
      await screen.findByText('This is the MM9PDY modded firmware 1.0.0 (bundled).'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/has not been reviewed or bundled/)).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /MM9PDY modded firmware 1\.0\.0/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled();
  });

  it('needs "I understand" before continuing with an unreviewed patch', async () => {
    await toFirmwareStep();
    dropPatch();
    expect(await screen.findByText(/has not been reviewed or bundled/)).toBeInTheDocument();
    expect(screen.getByText('MM9PDY modded firmware 7.7.7')).toBeInTheDocument();
    const continueButton = screen.getByRole('button', { name: 'Continue' });
    expect(continueButton).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'I understand' }));
    expect(continueButton).not.toBeDisabled();
  });

  it("shows a wrong-radio patch's error", async () => {
    vi.mocked(flash.loadChosenPatch).mockRejectedValue(
      new FirmwareError('patch-wrong-radio', 'This patch is for the AnyTone AT-D890UV.'),
    );
    await toFirmwareStep();
    dropPatch();
    expect(await screen.findByText('This patch is for the AnyTone AT-D890UV.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Stock firmware/ })).toBeChecked();
  });
});
