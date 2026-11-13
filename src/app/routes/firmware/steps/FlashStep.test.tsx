import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useReducer, type ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LoadedFirmwarePatch } from '@core/firmware/releases/types.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';
import { getFirmwareUpdater, RadioInterlockError } from '@integrations/radio-io';
import type { SerialPortLike } from '@integrations/radio-io';

import { DesignSystemV2Provider } from '../../../components/v2/index.ts';
import * as flash from '../../../services/firmwareFlash.ts';
import type {
  FirmwareFlashOutcome,
  VerifiedStockFirmware,
} from '../../../services/firmwareFlash.ts';
import {
  firmwareWizardReducer,
  INITIAL_FIRMWARE_WIZARD_STATE,
  type FirmwareWizardState,
} from '../firmwareWizardState.ts';
import FlashStep from './FlashStep.tsx';

vi.mock('../../../services/firmwareFlash.ts', () => ({
  grantFirmwarePort: vi.fn(),
  runFirmwareFlash: vi.fn(),
  prepareFlash: vi.fn(),
  formatFirmwareFlashSummary: vi.fn(() => 'SUMMARY TEXT'),
}));

const MINI = getFirmwareUpdater('baofeng-uv5rmini')!;
const STOCK = { via: 'files' } as unknown as VerifiedStockFirmware;
const fileFor = (layout: string) =>
  ({ provenance: 'published', layout }) as unknown as LoadedFirmwarePatch;
const PAIR: LoadedFirmwarePatch = { ...fileFor('L1'), otherLayouts: [fileFor('L2')] };
const imageFor = (layout: string) =>
  ({
    radioId: 'baofeng-uv5rmini',
    provenance: 'published',
    title: `${layout} build`,
    versionStamp: `mm9pdy-${layout}-1.0.0`,
    radioLayout: layout,
    radioBuild: 'mm9pdy-L1-0.9.0',
    radioReported: true,
    sha256: {},
    verifyHint: 'x',
  }) as unknown as PreparedFirmwareImage;
const L1_IMAGE = imageFor('L1');
const L2_IMAGE = imageFor('L2');

/** The loader's 0x8F as the flash service returns it: typed, with the loader having run. */
const OTHER_LAYOUT_0X8F = {
  ok: false,
  radioId: 'baofeng-uv5rmini',
  image: L1_IMAGE,
  code: 'nothingInstalled',
  message:
    'The file is for the other flash layout; the radio refused it. Its FM presets and volume may have been reset; nothing else changed.',
  position: 'result',
  radioTouched: true,
  startedAt: 'now',
} as const satisfies FirmwareFlashOutcome;

let latest: FirmwareWizardState;

function Harness({
  loaded = PAIR,
  layoutRetry = null,
  image = L1_IMAGE,
}: {
  loaded?: LoadedFirmwarePatch;
  layoutRetry?: FirmwareWizardState['layoutRetry'];
  image?: PreparedFirmwareImage;
}) {
  const [state, dispatch] = useReducer(firmwareWizardReducer, {
    ...INITIAL_FIRMWARE_WIZARD_STATE,
    step: 'flash',
    radioId: 'baofeng-uv5rmini',
    choice: { kind: 'user-patch', file: { name: 'p.json', bytes: new Uint8Array(0) } },
    loadedPatch: loaded,
    stock: STOCK,
    image,
    reinstallConfirmed: true,
    layoutRetry,
    checks: { risk: true, battery: true, cable: true, otherApps: true },
    probe: { summary: 'probe ok' },
    safetyBackupSerial: 'SERIAL-1234',
    safetyBackup: { kind: 'saved', radioKey: 'SERIAL-1234', summary: 'saved' },
  } satisfies FirmwareWizardState);
  useEffect(() => {
    latest = state;
  }, [state]);
  return (
    <DesignSystemV2Provider>
      {state.step === 'flash' && state.image ? (
        <FlashStep
          state={state}
          dispatch={dispatch}
          updater={MINI}
          image={state.image}
          onReenterUpdateMode={() => dispatch({ type: 'goTo', step: 'updateMode' })}
          onChooseFirmware={() => dispatch({ type: 'goTo', step: 'firmware' })}
          onRunningChange={() => undefined}
        />
      ) : (
        <p>Step: {state.step}</p>
      )}
    </DesignSystemV2Provider>
  );
}

/** FlashStep guards navigation, which needs a data router. */
function show(element: ReactElement) {
  const router = createMemoryRouter([{ path: '/firmware', element }], {
    initialEntries: ['/firmware'],
  });
  return render(<RouterProvider router={router} />);
}

async function flashWith(outcome: FirmwareFlashOutcome) {
  vi.mocked(flash.runFirmwareFlash).mockResolvedValueOnce(outcome);
  if (MINI.preflight?.updateModeConfirm) {
    fireEvent.click(screen.getByLabelText(MINI.preflight.updateModeConfirm));
  }
  fireEvent.click(screen.getByRole('button', { name: 'Connect and flash' }));
  await waitFor(() => expect(flash.runFirmwareFlash).toHaveBeenCalled());
  await screen.findByTestId('firmware-flash-summary');
}

const RETRY = 'Enter update mode again with the L2 file';

beforeEach(() => {
  vi.mocked(flash.runFirmwareFlash).mockReset();
  vi.mocked(flash.prepareFlash).mockReset();
  vi.mocked(flash.grantFirmwarePort).mockResolvedValue({} as SerialPortLike);
});

describe('FlashStep: a refusal before anything was installed', () => {
  it('a loader 0x8F shows "Nothing was installed", not "Recover the radio", and offers the L2 file', async () => {
    show(<Harness />);
    await flashWith(OTHER_LAYOUT_0X8F);
    expect(screen.getByText('Nothing was installed')).toBeInTheDocument();
    expect(screen.getByText(OTHER_LAYOUT_0X8F.message)).toBeInTheDocument();
    expect(screen.queryByText('Recover the radio')).toBeNull();
    expect(screen.queryByText(/Don't keep power-cycling the radio/)).toBeNull();
    expect(screen.getByRole('button', { name: RETRY })).toBeInTheDocument();
    // The progress dialog's plain Retry would resend the refused file: not offered here.
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    // Nothing is prepared or sent until the operator asks.
    expect(flash.prepareFlash).not.toHaveBeenCalled();
    expect(flash.runFirmwareFlash).toHaveBeenCalledTimes(1);
  });

  it('an app 0x83 before cmd 4 (radio untouched) offers the L2 file too', async () => {
    show(<Harness />);
    await flashWith({
      ...OTHER_LAYOUT_0X8F,
      radioTouched: false,
      message: 'Nothing was written to the firmware: the radio refused this file.',
    });
    expect(screen.getByText('Nothing was installed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: RETRY })).toBeInTheDocument();
  });

  it('the retry prepares the L2 file through the interlocks and goes back to update mode, keeping the ticks', async () => {
    vi.mocked(flash.prepareFlash).mockResolvedValue(L2_IMAGE);
    show(<Harness />);
    await flashWith(OTHER_LAYOUT_0X8F);
    fireEvent.click(screen.getByRole('button', { name: RETRY }));
    await waitFor(() => expect(latest.step).toBe('updateMode'));
    // prepareFlash runs the updater's interlocks (checkImage); the partner's layout is the radio's for this prepare.
    const [radioId, stock, choice, loaded, radioLayout, radioBuild, confirmed, reported] =
      vi.mocked(flash.prepareFlash).mock.calls[0]!;
    expect([radioId, stock, choice, loaded]).toEqual([
      'baofeng-uv5rmini',
      STOCK,
      latest.choice,
      PAIR,
    ]);
    expect(radioLayout).toBe('L2');
    expect(radioBuild).toBe('mm9pdy-L1-0.9.0');
    expect(confirmed).toBe(false);
    expect(reported).toBe(true);
    expect(latest.image).toBe(L2_IMAGE);
    expect(latest.layoutRetry).toEqual({ from: 'L1', to: 'L2' });
    expect(latest.reinstallConfirmed).toBe(false);
    expect(latest.checks).toEqual({ risk: true, battery: true, cable: true, otherApps: true });
    expect(latest.probe).toEqual({ summary: 'probe ok' });
    expect(latest.safetyBackup?.kind).toBe('saved');
    // Nothing more was sent: the operator re-enters update mode and presses Connect.
    expect(flash.runFirmwareFlash).toHaveBeenCalledTimes(1);
  });

  it('an interlock refusal of the L2 file stops the retry: nothing is sent and the step stays', async () => {
    vi.mocked(flash.prepareFlash).mockRejectedValue(
      new RadioInterlockError('This image changes the radio’s flash outside its area.'),
    );
    show(<Harness />);
    await flashWith(OTHER_LAYOUT_0X8F);
    fireEvent.click(screen.getByRole('button', { name: RETRY }));
    expect(
      await screen.findByText(/outside its area\. Nothing was sent to the radio\./),
    ).toBeInTheDocument();
    expect(latest.step).toBe('flash');
    expect(latest.image).toBe(L1_IMAGE);
    expect(latest.layoutRetry).toBeNull();
  });

  it('a release with no file for the other layout says so and offers nothing', async () => {
    show(<Harness loaded={fileFor('L1')} />);
    await flashWith(OTHER_LAYOUT_0X8F);
    expect(screen.getByText('Nothing was installed')).toBeInTheDocument();
    expect(
      screen.getByText(/This release has no file for the radio's other flash layout/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enter update mode again with/ })).toBeNull();
  });

  it('is offered once per flash: after the retry, a second refusal offers nothing', async () => {
    show(<Harness image={L2_IMAGE} layoutRetry={{ from: 'L1', to: 'L2' }} />);
    await flashWith({ ...OTHER_LAYOUT_0X8F, image: L2_IMAGE });
    expect(screen.getByText(/refused the L1 file and then the L2 file/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enter update mode again with/ })).toBeNull();
  });

  it('any other refusal keeps today’s handling and offers no retry', async () => {
    show(<Harness />);
    await flashWith({
      ...OTHER_LAYOUT_0X8F,
      code: 'protocol',
      message: 'Recover the radio: leave the cable in. (Result 0x83.)',
    });
    expect(screen.getByText('Recover the radio')).toBeInTheDocument();
    expect(screen.queryByText('Nothing was installed')).toBeNull();
    expect(screen.queryByRole('button', { name: /Enter update mode again with/ })).toBeNull();
  });
});
