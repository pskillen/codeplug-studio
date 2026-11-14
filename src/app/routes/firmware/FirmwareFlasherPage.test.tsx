import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FirmwareError } from '@core/firmware/errors.ts';
import { radioReportFrame } from '@core/radios/baofeng/uv-5r-mini/__fixtures__/radioReportFrame.ts';
import { DEVELOPER_MODE_KEY, setDeveloperMode } from '@integrations/preferences/developerMode.ts';
import type {
  PublishedFirmwareRelease,
  FirmwareReleaseSummary,
  LoadedFirmwarePatch,
} from '@core/firmware/releases/types.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';
import * as radioIo from '@integrations/radio-io';
import { getFirmwareUpdater } from '@integrations/radio-io';

import * as envGate from '../../services/firmwareFlashEnvGate.ts';
import * as flash from '../../services/firmwareFlash.ts';
import FirmwareFlasherPage, {
  FIRMWARE_DESKTOP_ONLY,
  FIRMWARE_UNAVAILABLE_ON_SITE,
} from './FirmwareFlasherPage.tsx';

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

vi.mock('../../services/firmwareFlash.ts', async (importOriginal) => ({
  // Pure helpers the UV-5R Mini's Prepare step uses.
  releaseHasFileForLayout: (await importOriginal<typeof flash>()).releaseHasFileForLayout,
  noFileForRadioMessage: (await importOriginal<typeof flash>()).noFileForRadioMessage,
  filesToNamedBytes: vi.fn(async (files: File[]) =>
    files.map((f) => ({ name: f.name, bytes: new Uint8Array(1) })),
  ),
  verifyStockFiles: vi.fn(),
  prepareFlash: vi.fn(),
  listPublishedReleases: vi.fn(),
  loadChosenPatch: vi.fn(),
  grantFirmwarePort: vi.fn(),
  grantFirmwarePreflightPort: vi.fn(),
  runFirmwarePreflightProbe: vi.fn(),
  grantFirmwareSafetyBackupPort: vi.fn(),
  runFirmwareSafetyBackup: vi.fn(),
  grantFirmwareRadioReportPort: vi.fn(),
  readFirmwareRadioReport: vi.fn(),
  recordFirmwareSafetyBackupSaved: vi.fn(() => true),
  recordFirmwareSafetyBackupFile: vi.fn(),
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

function release(tag: string, channel: 'final' | 'rc'): PublishedFirmwareRelease {
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

function summaryOf(r: PublishedFirmwareRelease): FirmwareReleaseSummary {
  return {
    radioId: r.radioId,
    key: r.tag,
    label: r.tag,
    title: `MM9PDY modded firmware ${r.tag}`,
    channel: r.channel,
    provenance: 'published',
    release: r,
  };
}

const FINAL = summaryOf(release('1.0.0', 'final'));
const RC = summaryOf(release('1.1.0-rc.1', 'rc'));

function loadedFor(r: PublishedFirmwareRelease): LoadedFirmwarePatch {
  return {
    bytes: new Uint8Array(0),
    sha256: r.patchSha256,
    parsed: { description: { version: r.tag } } as unknown as LoadedFirmwarePatch['parsed'],
    provenance: 'published',
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
    vi.mocked(flash.listPublishedReleases).mockImplementation(async (_radioId, includeRc) =>
      includeRc ? [FINAL, RC] : [FINAL],
    );
    vi.mocked(flash.loadChosenPatch).mockImplementation(async (_radioId, choice) =>
      choice.kind === 'release' ? loadedFor(choice.summary.release!) : UNREVIEWED,
    );
    vi.mocked(flash.grantFirmwarePort).mockResolvedValue({} as radioIo.SerialPortLike);
    vi.mocked(flash.grantFirmwarePreflightPort).mockResolvedValue({} as radioIo.SerialPortLike);
    vi.mocked(flash.grantFirmwareSafetyBackupPort).mockResolvedValue({} as radioIo.SerialPortLike);
  });

  it('renders the radio card', () => {
    renderPage();
    expect(screen.getByRole('radio', { name: /Baofeng DM-32UV/ })).toHaveTextContent(
      DM32.stock.version,
    );
  });

  it('requires a patch and shows own-image instructions for a radio without stock flash', async () => {
    const stock = {
      ...DM32.stock,
      zip: undefined,
      stockFlashOffered: false,
      stockSources: [
        {
          kind: 'own-image' as const,
          label: 'Your image',
          instructions: 'Build it from your radio.',
        },
      ],
      members: [{ ...DM32.stock.members[0]!, fileName: 'stock.ufw' }],
    };
    vi.mocked(envGate.listOfferedFirmwareUpdaters).mockReturnValue([{ ...DM32, stock }]);
    renderPage();
    fireEvent.click(screen.getByRole('radio', { name: /Baofeng DM-32UV/ }));
    cont();
    expect(screen.queryByText(/Stock firmware \(v1/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    fireEvent.click(await screen.findByRole('radio', { name: /MM9PDY modded firmware 1.0.0/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled());
    cont();
    expect(screen.getByText(/Build it from your radio/)).toBeInTheDocument();
    expect(screen.getByText('Drop stock.ufw')).toBeInTheDocument();
    expect(screen.queryByText(/Files Studio needs from the zip/)).not.toBeInTheDocument();
  });

  describe('a radio whose way back to stock is a to-stock patch', () => {
    const stock = {
      ...DM32.stock,
      stockFlashOffered: false,
      baseName: 'syn-v1',
      stockReturn: { help: 'Use the to-stock file from the release artifact.' },
    };
    const toStockLoaded = (buildName: string): LoadedFirmwarePatch => ({
      bytes: new Uint8Array(0),
      sha256: '34'.repeat(32),
      parsed: {
        description: { name: 'baofeng-dm32-firmware', version: '0.1', base: 'syn-v1', buildName },
      } as unknown as LoadedFirmwarePatch['parsed'],
      provenance: 'unreviewed',
    });
    const dropToStock = (name: string) => {
      const card = screen.getByText('Back to stock').closest('div')!;
      const input = card.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [new File(['{}'], name)] } });
    };

    beforeEach(() => {
      vi.mocked(envGate.listOfferedFirmwareUpdaters).mockReturnValue([{ ...DM32, stock }]);
    });

    it('offers "Back to stock" with its help line, and never the plain stock', async () => {
      renderPage();
      fireEvent.click(screen.getByRole('radio', { name: /Baofeng DM-32UV/ }));
      cont();
      expect(screen.getByText('Back to stock')).toBeInTheDocument();
      expect(
        screen.getByText('Use the to-stock file from the release artifact.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('radio', { name: /Stock firmware/ })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    });

    it('takes a to-stock patch with no risk tick and names the stock it puts back', async () => {
      vi.mocked(flash.loadChosenPatch).mockResolvedValue(toStockLoaded('syn-v1'));
      renderPage();
      fireEvent.click(screen.getByRole('radio', { name: /Baofeng DM-32UV/ }));
      cont();
      dropToStock('uv5rmini-fw-to-stock-syn-v1.patch.json');
      expect(
        await screen.findByText(`This file puts back the stock firmware ${stock.version}.`),
      ).toBeInTheDocument();
      expect(vi.mocked(flash.loadChosenPatch).mock.calls[0]![1]).toMatchObject({
        kind: 'back-to-stock',
      });
      expect(screen.queryByText('I understand')).not.toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled());
    });

    it('refuses a file that is not a to-stock patch', async () => {
      vi.mocked(flash.loadChosenPatch).mockRejectedValue(
        new FirmwareError('patch-not-to-stock', "This file isn't a to-stock patch."),
      );
      renderPage();
      fireEvent.click(screen.getByRole('radio', { name: /Baofeng DM-32UV/ }));
      cont();
      dropToStock('mm9pdy.patch.json');
      expect(await screen.findByText("This file isn't a to-stock patch.")).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    });
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

  it('lists the stock sources on the Stock step', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('radio', { name: /Baofeng DM-32UV/ }));
    cont();
    cont();
    expect(screen.getByText('Where to get it:')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: DM32.stock.zip!.fileName })).toHaveAttribute(
      'href',
      expect.stringMatching(/^https:/),
    );
  });

  describe('a radio with its own pre-flight', () => {
    const WITH_PREFLIGHT = {
      ...DM32,
      preflight: {
        attestations: [
          { id: 'one', label: 'Attestation one', help: 'Look at the screen.' },
          { id: 'two', label: 'Attestation two' },
        ],
        probe: {
          title: 'Check the radio',
          steps: ['Switch the radio on normally.'],
          link: DM32.link,
          run: vi.fn(),
        },
      },
    } as unknown as typeof DM32;

    async function walkToPreflight() {
      vi.mocked(envGate.listOfferedFirmwareUpdaters).mockReturnValue([WITH_PREFLIGHT]);
      renderPage();
      fireEvent.click(screen.getByRole('radio', { name: /Baofeng DM-32UV/ }));
      cont();
      cont();
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [new File(['x'], 'stock.zip')] } });
      await screen.findByText(/verified/);
      cont();
      await screen.findByText(/Ready to flash/);
      cont();
    }

    const SKIP_LABEL = "I've already tested this radio with Codeplug Studio";
    /** Tick every box except the opt-in to skip the radio check. */
    const tickAcknowledgements = () => {
      for (const c of screen.getAllByRole('checkbox')) {
        if (c !== screen.getByLabelText(SKIP_LABEL)) fireEvent.click(c);
      }
    };

    it('blocks Continue until every attestation is ticked and the probe passed', async () => {
      vi.mocked(flash.runFirmwarePreflightProbe).mockResolvedValue({
        ok: true,
        summary: 'Model X',
      });
      await walkToPreflight();
      expect(screen.getByText('Look at the screen.')).toBeInTheDocument();
      const continueButton = screen.getByRole('button', { name: 'Continue' });
      tickAcknowledgements();
      expect(continueButton).toBeDisabled();
      fireEvent.click(screen.getByRole('button', { name: 'Check the radio' }));
      expect(await screen.findByText(/Radio checked: Model X/)).toBeInTheDocument();
      expect(continueButton).not.toBeDisabled();
    });

    it('leaves the skip box unticked by default and lets it replace the radio check', async () => {
      await walkToPreflight();
      const skip = screen.getByLabelText(SKIP_LABEL);
      expect(skip).not.toBeChecked();
      tickAcknowledgements();
      expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
      fireEvent.click(skip);
      expect(screen.getByRole('button', { name: 'Check the radio' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled();
      expect(flash.runFirmwarePreflightProbe).not.toHaveBeenCalled();
    });

    it('still needs the acknowledgements when the radio check is skipped', async () => {
      await walkToPreflight();
      fireEvent.click(screen.getByLabelText(SKIP_LABEL));
      expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    });

    it('shows the refusal and keeps Continue disabled when the probe fails', async () => {
      vi.mocked(flash.runFirmwarePreflightProbe).mockResolvedValue({
        ok: false,
        code: 'wrongIdent',
        message: 'This radio reports something else.',
      });
      await walkToPreflight();
      tickAcknowledgements();
      fireEvent.click(screen.getByRole('button', { name: 'Check the radio' }));
      expect(await screen.findByText('This radio reports something else.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    });
  });

  describe('a radio that requires a safety backup', () => {
    const SAFETY = {
      title: 'Safety backup of the radio',
      why: 'Calibration cannot be rebuilt.',
      steps: ['Switch on normally.'],
      link: DM32.link,
      expectedDuration: '1 minute',
      recordFamily: 'fake',
      serialHint: 'On the label.',
      normaliseSerial: (t: string) => t.trim().toUpperCase(),
      run: vi.fn(),
      verifyFile: vi.fn(),
    };
    const WITH = {
      ...DM32,
      preflight: { attestations: [], probe: undefined, safetyBackup: SAFETY },
    } as unknown as typeof DM32;
    const BUTTON = 'Check / take safety backup';

    async function walk(descriptor: typeof DM32 = WITH) {
      vi.mocked(envGate.listOfferedFirmwareUpdaters).mockReturnValue([descriptor]);
      renderPage();
      fireEvent.click(screen.getByRole('radio', { name: /Baofeng DM-32UV/ }));
      cont();
      cont();
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [new File(['x'], 'stock.zip')] } });
      await screen.findByText(/verified/);
      cont();
      await screen.findByText(/Ready to flash/);
      cont();
      for (const c of screen.getAllByRole('checkbox')) fireEvent.click(c);
    }
    const typeSerial = (v: string) =>
      fireEvent.change(screen.getByLabelText('Radio serial number'), { target: { value: v } });
    const continueButton = () => screen.getByRole('button', { name: 'Continue' });

    it('needs the serial, and keeps Continue disabled until done', async () => {
      await walk();
      expect(screen.getByText('Calibration cannot be rebuilt.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: BUTTON })).toBeDisabled();
      expect(continueButton()).toBeDisabled();
    });

    it('already saved enables Continue', async () => {
      vi.mocked(flash.runFirmwareSafetyBackup).mockResolvedValue({
        ok: true,
        outcome: { kind: 'already-saved', radioKey: 'AB 1', summary: 'RT V100' },
      });
      await walk();
      typeSerial('ab 1');
      fireEvent.click(screen.getByRole('button', { name: BUTTON }));
      expect(await screen.findByText(/already saved/)).toBeInTheDocument();
      expect(flash.runFirmwareSafetyBackup).toHaveBeenCalledWith(
        expect.objectContaining({ serial: 'ab 1' }),
      );
      expect(continueButton()).not.toBeDisabled();
    });

    it('a taken backup needs the tick, which records it', async () => {
      vi.mocked(flash.runFirmwareSafetyBackup).mockResolvedValue({
        ok: true,
        outcome: {
          kind: 'taken',
          radioKey: 'AB 1',
          summary: 'RT V100',
          region: 'cal',
          fileName: 'cal-AB1.zip',
          zipBytes: new Uint8Array(1),
          sha256: 'aa',
          fingerprint: '1a2b3c4d',
        },
      });
      await walk();
      typeSerial('AB 1');
      fireEvent.click(screen.getByRole('button', { name: BUTTON }));
      const tick = await screen.findByRole('checkbox', {
        name: "I've saved cal-AB1.zip (fingerprint 1a2b3c4d)",
      });
      expect(flash.recordFirmwareSafetyBackupSaved).not.toHaveBeenCalled();
      expect(continueButton()).toBeDisabled();
      fireEvent.click(tick);
      expect(flash.recordFirmwareSafetyBackupSaved).toHaveBeenCalledTimes(1);
      expect(continueButton()).not.toBeDisabled();
    });

    it('shows a refusal and the probe skip does not stand in for it', async () => {
      vi.mocked(flash.runFirmwareSafetyBackup).mockResolvedValue({
        ok: false,
        code: 'wrongIdent',
        message: 'Not an RT95.',
      });
      await walk({
        ...WITH,
        preflight: {
          attestations: [],
          probe: { title: 'Check the radio', steps: [], link: DM32.link, run: vi.fn() },
          safetyBackup: SAFETY,
        },
      } as unknown as typeof DM32);
      fireEvent.click(screen.getByLabelText("I've already tested this radio with Codeplug Studio"));
      expect(continueButton()).toBeDisabled();
      typeSerial('AB 1');
      fireEvent.click(screen.getByRole('button', { name: BUTTON }));
      expect(await screen.findByText('Not an RT95.')).toBeInTheDocument();
      expect(continueButton()).toBeDisabled();
    });

    it('shows no safety backup section for a radio without one', async () => {
      await walk(DM32);
      expect(screen.queryByLabelText('Radio serial number')).not.toBeInTheDocument();
    });
  });

  it('asks for the update-mode confirmation before Connect and flash when the radio has one', async () => {
    const CONFIRM = 'The screen is blank. It does not say UPDATE THE RF CPU.';
    vi.mocked(envGate.listOfferedFirmwareUpdaters).mockReturnValue([
      { ...DM32, preflight: { attestations: [], updateModeConfirm: CONFIRM } } as typeof DM32,
    ]);
    await walkToFlashStep();
    const connect = screen.getByRole('button', { name: 'Connect and flash' });
    expect(connect).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: CONFIRM }));
    expect(connect).not.toBeDisabled();
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

  it('shows the connect-step warnings beside "Connect and flash"', async () => {
    await walkToFlashStep();
    expect(screen.getByRole('button', { name: 'Connect and flash' })).toBeInTheDocument();
    expect(screen.getByText(DM32.stock.bootloaderEntry.warnings[0]!)).toBeInTheDocument();
  });

  it.each([
    ['port-closed-by-radio', /The radio restarted into the new firmware/],
    ['acknowledged', /Power-cycle the radio if it hasn't restarted, then check: The radio boots/],
    ['eot-sent', /Power-cycle the radio if it hasn't restarted, then check: The radio boots/],
    ['no-reply', /Every block was accepted, but the radio didn't confirm the end/],
  ] as const)('renders the %s end state as success', async (end, message) => {
    vi.mocked(flash.runFirmwareFlash).mockResolvedValue({
      ok: true,
      radioId: 'baofeng-dm32uv',
      image: IMAGE,
      ident: { radioId: 'baofeng-dm32uv', model: 'M', raw: new Uint8Array(0) },
      result: { framesSent: 1, dataFrames: 1, elapsedMs: 1, end },
      startedAt: 'now',
    });
    await walkToFlashStep();
    fireEvent.click(screen.getByRole('button', { name: 'Connect and flash' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument();
    expect(screen.queryByText(/Don't keep power-cycling the radio/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nothing was written/)).not.toBeInTheDocument();
  });

  it('offers Start over after step 1, resets the wizard, and hides it while a flash runs', async () => {
    vi.mocked(flash.runFirmwareFlash).mockReturnValue(new Promise(() => {}));
    await walkToFlashStep();
    expect(screen.getByRole('button', { name: 'Start over' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Connect and flash' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Start over' })).toBeNull());
  });

  it('Start over returns to step 1 with the choices cleared', async () => {
    await walkToFlashStep();
    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(screen.queryByRole('button', { name: 'Start over' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
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
    expect(
      screen.getByRole('link', { name: 'recovering a radio after a failed flash' }),
    ).toHaveAttribute(
      'href',
      'https://github.com/pskillen/codeplug-studio/blob/main/docs/features/firmware-flashing/README.md#recovery',
    );
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

  describe('in the Android app (#1657)', () => {
    /** A granted device as the Capacitor plugin lists it: no Web Serial port anywhere. */
    const CAPACITOR_PORT: flash.FirmwarePort = {
      transport: 'capacitor',
      device: {
        deviceId: 7,
        vendorId: 0x1a86,
        productId: 0x7523,
      } as unknown as radioIo.UsbDeviceLike,
    };

    beforeEach(() => {
      vi.mocked(radioIo.isWebSerialSupported).mockReturnValue(false);
      vi.mocked(radioIo.isCapacitorSerialSupported).mockReturnValue(true);
      vi.mocked(flash.grantFirmwarePort).mockResolvedValue(CAPACITOR_PORT);
    });

    it('says desktop only when no radio is offered', () => {
      vi.mocked(envGate.listOfferedFirmwareUpdaters).mockReturnValue([]);
      renderPage();
      expect(screen.getByText(FIRMWARE_DESKTOP_ONLY)).toBeInTheDocument();
    });

    it('shows the wizard, not the release browser, when a radio is offered', () => {
      renderPage();
      expect(screen.getByRole('radio', { name: /Baofeng DM-32UV/ })).toBeInTheDocument();
      expect(screen.queryByText(/This browser can't flash firmware/)).not.toBeInTheDocument();
    });

    it('lets the stock picker take any file: the pinned hashes decide', () => {
      renderPage();
      fireEvent.click(screen.getByRole('radio', { name: /Baofeng DM-32UV/ }));
      cont();
      cont();
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(input).not.toHaveAttribute('accept');
    });

    it('flashes through the Capacitor port, with the phone copy', async () => {
      vi.mocked(flash.runFirmwareFlash).mockResolvedValue({
        ok: true,
        radioId: 'baofeng-dm32uv',
        image: IMAGE,
        ident: { radioId: 'baofeng-dm32uv', model: 'M', raw: new Uint8Array(0) },
        result: { framesSent: 1, dataFrames: 1, elapsedMs: 1, end: 'eot-sent' },
        startedAt: 'now',
      });
      await walkToFlashStep();
      expect(screen.getByText(/through a USB-OTG adapter, tap the button/)).toBeInTheDocument();
      expect(screen.getByText(/Keep the app in front and the screen on/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Connect and flash' }));
      expect(await screen.findByText(/then check: The radio boots/)).toBeInTheDocument();
      expect(flash.runFirmwareFlash).toHaveBeenCalledWith(
        expect.objectContaining({ radioId: 'baofeng-dm32uv', port: CAPACITOR_PORT }),
      );
    });

    it('shows why no cable was found, and sends nothing', async () => {
      vi.mocked(flash.grantFirmwarePort).mockRejectedValueOnce(
        new Error('More than one programming cable is connected. Unplug the others and try again.'),
      );
      await walkToFlashStep();
      fireEvent.click(screen.getByRole('button', { name: 'Connect and flash' }));
      expect(
        await screen.findByText(/More than one programming cable is connected/),
      ).toBeInTheDocument();
      expect(flash.runFirmwareFlash).not.toHaveBeenCalled();
    });

    describe('with developer mode on', () => {
      beforeEach(async () => {
        const actual = await vi.importActual<typeof envGate>(
          '../../services/firmwareFlashEnvGate.ts',
        );
        vi.mocked(envGate.listOfferedFirmwareUpdaters).mockImplementation(
          actual.listOfferedFirmwareUpdaters,
        );
        setDeveloperMode(true);
        vi.mocked(flash.grantFirmwareRadioReportPort).mockResolvedValue(CAPACITOR_PORT);
        vi.mocked(flash.readFirmwareRadioReport).mockResolvedValue({
          ok: true,
          bytes: radioReportFrame({}),
        });
        vi.mocked(flash.loadChosenPatch).mockResolvedValue(UNREVIEWED);
      });
      afterEach(() => localStorage.removeItem(DEVELOPER_MODE_KEY));

      it('offers the developer-mode radios only (#1674)', () => {
        renderPage();
        const offered = screen.getAllByRole('radio');
        expect(offered).toHaveLength(4);
        expect(screen.getByRole('radio', { name: /Baofeng DM-32UV/ })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /AnyTone AT-D890UV/ })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /RT95 front panel/ })).toBeInTheDocument();
        expect(screen.getByRole('radio', { name: /UV-5R Mini/ })).toBeInTheDocument();
      });

      it('reads the radio on Prepare through the Capacitor port', async () => {
        renderPage();
        fireEvent.click(screen.getByRole('radio', { name: /UV-5R Mini/ }));
        cont();
        const patch = document.querySelector(
          'input[type="file"][accept=".json"]',
        ) as HTMLInputElement;
        fireEvent.change(patch, { target: { files: [new File(['{}'], 'mine.patch.json')] } });
        await waitFor(() => expect(flash.loadChosenPatch).toHaveBeenCalled());
        cont();
        const stock = document.querySelector('input[type="file"]') as HTMLInputElement;
        fireEvent.change(stock, { target: { files: [new File(['x'], 'stock.ufw')] } });
        await screen.findByText(/verified/);
        cont();

        expect(flash.readFirmwareRadioReport).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Read the radio' }));
        expect(await screen.findByText('MM9PDY build: mm9pdy-L2-0.2.0-rc.1')).toBeInTheDocument();
        expect(flash.grantFirmwareRadioReportPort).toHaveBeenCalledWith('baofeng-uv5rmini');
        expect(flash.readFirmwareRadioReport).toHaveBeenCalledTimes(1);
        expect(flash.readFirmwareRadioReport).toHaveBeenCalledWith(
          expect.objectContaining({ radioId: 'baofeng-uv5rmini', port: CAPACITOR_PORT }),
        );
        await waitFor(() => expect(flash.prepareFlash).toHaveBeenCalled());
        expect(vi.mocked(flash.prepareFlash).mock.calls.at(-1)![4]).toBe('L2');
      });
    });
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
    vi.mocked(flash.listPublishedReleases).mockImplementation(async (_radioId, includeRc) =>
      includeRc ? [FINAL, RC] : [FINAL],
    );
    vi.mocked(flash.loadChosenPatch).mockImplementation(async (_radioId, choice) =>
      choice.kind === 'release' ? loadedFor(choice.summary.release!) : UNREVIEWED,
    );
  });

  describe('without Web Serial (phones, tablets, other browsers)', () => {
    beforeEach(() => {
      vi.mocked(radioIo.isWebSerialSupported).mockReturnValue(false);
    });

    it('lists the published releases, with notes and RCs, but no way to flash', async () => {
      renderPage();
      expect(screen.getByText(/This browser can't flash firmware/)).toBeInTheDocument();
      expect(await screen.findByText('Summary of 1.0.0.')).toBeInTheDocument();
      expect(screen.getByText(DM32.stock.label)).toBeInTheDocument();
      expect(screen.queryByText(/1\.1\.0-rc\.1/)).not.toBeInTheDocument();
      expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Show release candidates'));
      const rc = await screen.findByText(/MM9PDY modded firmware 1\.1\.0-rc\.1/);
      expect(rc).toHaveTextContent('Pre-release');

      const details = screen.getAllByText('Release notes')[0]!.closest('details')!;
      details.open = true;
      fireEvent(details, new Event('toggle'));
      expect(
        await screen.findByText(/Notes for 1\.1\.0-rc\.1|Notes for 1\.0\.0/),
      ).toBeInTheDocument();
      expect(flash.loadChosenPatch).not.toHaveBeenCalled();
    });

    it('says when the list cannot be downloaded, and retries', async () => {
      vi.mocked(flash.listPublishedReleases).mockImplementationOnce(async () => {
        throw new FirmwareError('patch-unreadable', 'The list is unavailable.');
      });
      renderPage();
      expect(await screen.findByText('The list is unavailable.')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
      expect(await screen.findByText('Summary of 1.0.0.')).toBeInTheDocument();
    });
  });

  it('takes both files of a release with one file per flash layout, without naming the layouts', async () => {
    const layouts = { layouts: ['L1', 'L2'], fromBuildName: () => undefined };
    vi.mocked(envGate.listOfferedFirmwareUpdaters).mockReturnValue([
      { ...DM32, stock: { ...DM32.stock, releaseLayouts: layouts } },
    ]);
    vi.mocked(flash.loadChosenPatch).mockResolvedValue({
      ...UNREVIEWED,
      layout: 'L1',
      otherLayouts: [{ ...UNREVIEWED, layout: 'L2' }],
    });
    await toFirmwareStep();
    expect(
      screen.getByText(/A release has a file for each radio firmware it supports\. Pick them all/),
    ).toBeInTheDocument();
    const input = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
    expect(input.multiple).toBe(true);
    fireEvent.change(input, {
      target: {
        files: [new File(['{}'], 'fw-L1.patch.json'), new File(['{}'], 'fw-L2.patch.json')],
      },
    });
    await waitFor(() => expect(flash.loadChosenPatch).toHaveBeenCalled());
    // The flash layout is an internal detail (#1670): named only with developer mode on.
    expect(screen.queryByText(/Flash layouts/)).toBeNull();
    const choice = vi.mocked(flash.loadChosenPatch).mock.calls[0]![1];
    expect(choice.kind === 'user-patch' && choice.file.name).toBe('fw-L1.patch.json');
    expect(choice.kind === 'user-patch' && choice.otherFiles?.map((f) => f.name)).toEqual([
      'fw-L2.patch.json',
    ]);
  });

  it('names the layouts of the patch files with developer mode on', async () => {
    setDeveloperMode(true);
    try {
      const layouts = { layouts: ['L1', 'L2'], fromBuildName: () => undefined };
      vi.mocked(envGate.listOfferedFirmwareUpdaters).mockReturnValue([
        { ...DM32, stock: { ...DM32.stock, releaseLayouts: layouts } },
      ]);
      vi.mocked(flash.loadChosenPatch).mockResolvedValue({
        ...UNREVIEWED,
        layout: 'L1',
        otherLayouts: [{ ...UNREVIEWED, layout: 'L2' }],
      });
      await toFirmwareStep();
      const input = document.querySelector(
        'input[type="file"][accept=".json"]',
      ) as HTMLInputElement;
      fireEvent.change(input, { target: { files: [new File(['{}'], 'fw-L1.patch.json')] } });
      expect(await screen.findByText('Flash layouts: L1, L2.')).toBeInTheDocument();
    } finally {
      localStorage.removeItem(DEVELOPER_MODE_KEY);
    }
  });

  it('takes one patch file for a radio without layouts', async () => {
    await toFirmwareStep();
    const input = document.querySelector('input[type="file"][accept=".json"]') as HTMLInputElement;
    expect(input.multiple).toBe(false);
    dropPatch();
    await waitFor(() => expect(flash.loadChosenPatch).toHaveBeenCalled());
    const choice = vi.mocked(flash.loadChosenPatch).mock.calls[0]![1];
    expect(choice.kind === 'user-patch' && choice.otherFiles).toBeUndefined();
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

  it('says when the release list cannot be downloaded, and retries', async () => {
    vi.mocked(flash.listPublishedReleases).mockImplementationOnce(async () => {
      throw new FirmwareError('patch-unreadable', 'The list is unavailable.');
    });
    renderPage();
    fireEvent.click(screen.getByRole('radio', { name: /Baofeng DM-32UV/ }));
    cont();
    expect(await screen.findByText(/The list is unavailable\. Stock firmware/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Stock firmware/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('radio', { name: /MM9PDY modded firmware 1\.0\.0/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/The list is unavailable/)).not.toBeInTheDocument();
  });

  it('expands the release notes', async () => {
    await toFirmwareStep();
    const details = screen.getAllByText('Release notes')[0]!.closest('details')!;
    details.open = true;
    fireEvent(details, new Event('toggle'));
    expect(await screen.findByText('Notes for 1.0.0')).toBeInTheDocument();
    expect(screen.getByText("What's in it").tagName).toBe('STRONG');
  });

  it('selects a published release and shows its verify hint when done', async () => {
    const image = {
      ...IMAGE,
      provenance: 'published',
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
      await screen.findByText(/MM9PDY modded firmware 1\.0\.0 \(published\)/),
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

  it('treats a dropped file identical to a published release as that release', async () => {
    vi.mocked(flash.loadChosenPatch).mockImplementation(async (_radioId, choice) =>
      choice.kind === 'user-patch' ? loadedFor(FINAL.release!) : loadedFor(FINAL.release!),
    );
    await toFirmwareStep();
    dropPatch();
    expect(
      await screen.findByText('This is the MM9PDY modded firmware 1.0.0 (published).'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/not one of the firmware project's published releases/),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /MM9PDY modded firmware 1\.0\.0/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled();
  });

  it('needs "I understand" before continuing with an unreviewed patch', async () => {
    await toFirmwareStep();
    dropPatch();
    expect(
      await screen.findByText(/not one of the firmware project's published releases/),
    ).toBeInTheDocument();
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
