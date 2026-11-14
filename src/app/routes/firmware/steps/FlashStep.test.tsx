import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useReducer, type ReactElement } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
import FlashStep, { RETRY_OTHER_FILE_LABEL } from './FlashStep.tsx';

vi.mock('../../../services/firmwareFlash.ts', () => ({
  grantFirmwarePort: vi.fn(),
  runFirmwareFlash: vi.fn(),
  prepareFlash: vi.fn(),
  formatFirmwareFlashSummary: vi.fn(() => 'SUMMARY TEXT'),
}));

const MINI = getFirmwareUpdater('baofeng-uv5rmini')!;
const STOCK = { via: 'files' } as unknown as VerifiedStockFirmware;
/**
 * A release file on an NRF base: a same-suffix pair (a v0.04 NRF base is made up for the test), so each file is the
 * other's retry partner. Today's real pair crosses the suffix and has no partner (see below).
 */
const NRF_BASE: Record<string, string> = { L1: 'nrf-v0.04', L2: 'nrf-v0.27' };
const fileFor = (layout: string, base = NRF_BASE[layout]!) =>
  ({
    provenance: 'published',
    layout,
    parsed: { description: { base } },
  }) as unknown as LoadedFirmwarePatch;
const PAIR: LoadedFirmwarePatch = { ...fileFor('L1'), otherLayouts: [fileFor('L2')] };
const imageFor = (layout: string, o: { reported?: boolean; base?: string } = {}) =>
  ({
    radioId: 'baofeng-uv5rmini',
    provenance: 'published',
    title: `${layout} build`,
    versionStamp: `mm9pdy-${layout}-1.0.0`,
    baseName: o.base ?? NRF_BASE[layout],
    radioLayout: layout,
    ...(o.reported === false
      ? { radioCodeBase: o.base ?? NRF_BASE[layout] }
      : { radioBuild: 'mm9pdy-L1-0.9.0', radioReported: true, radioCodeBase: 'nrf-v0.04' }),
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
    "The file isn't for this radio's firmware; the radio refused it. Its FM presets and volume may have been reset; nothing else changed.",
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

const RETRY = RETRY_OTHER_FILE_LABEL;

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
    // The flash layout is an internal detail (#1670): the user is told about their radio's firmware.
    expect(screen.getByText(/this file isn't for your radio's firmware/)).toBeInTheDocument();
    expect(screen.queryByText(/flash layout|the L2 file/)).toBeNull();
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
    const [radioId, stock, choice, loaded, radioLayout, radioBuild, confirmed, reported, base] =
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
    // A reported code base stands: the interlocks refuse the retry if it would change it.
    expect(base).toBe('nrf-v0.04');
    expect(latest.image).toBe(L2_IMAGE);
    expect(latest.layoutRetry).toEqual({ from: 'L1', to: 'L2', toBase: 'nrf-v0.27' });
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

  it('a stock radio retries L2 to L1 and L1 to L2, each prepared on the partner file own base', async () => {
    for (const [from, to] of [
      ['L2', 'L1'],
      ['L1', 'L2'],
    ] as const) {
      const refused = imageFor(from, { reported: false });
      const next = imageFor(to, { reported: false });
      vi.mocked(flash.prepareFlash).mockReset().mockResolvedValue(next);
      vi.mocked(flash.runFirmwareFlash).mockReset();
      const view = show(<Harness image={refused} />);
      await flashWith({ ...OTHER_LAYOUT_0X8F, image: refused });
      fireEvent.click(screen.getByRole('button', { name: RETRY }));
      await waitFor(() => expect(latest.step).toBe('updateMode'));
      const call = vi.mocked(flash.prepareFlash).mock.calls[0]!;
      expect(call[4]).toBe(to);
      // The radio's answers were wrong; the partner is picked and prepared on its own base.
      expect(call[8]).toBe(NRF_BASE[to]);
      expect(latest.layoutRetry).toEqual({ from, to, toBase: NRF_BASE[to] });
      view.unmount();
    }
  });

  it("today's pair (L1 NRFB v0.04, L2 NRF v0.27) crosses the suffix: no retry is offered", async () => {
    const today: LoadedFirmwarePatch = {
      ...fileFor('L1', 'nrfb-v0.04'),
      otherLayouts: [fileFor('L2', 'nrf-v0.27')],
    };
    const refused = imageFor('L2', { reported: false, base: 'nrf-v0.27' });
    show(<Harness loaded={today} image={refused} />);
    await flashWith({ ...OTHER_LAYOUT_0X8F, image: refused });
    expect(screen.getByText('Nothing was installed')).toBeInTheDocument();
    expect(screen.getByText(/This release has no other file for this radio/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enter update mode again with/ })).toBeNull();
    expect(flash.prepareFlash).not.toHaveBeenCalled();
  });

  it('a release with no file for the other layout says so and offers nothing', async () => {
    show(<Harness loaded={fileFor('L1')} />);
    await flashWith(OTHER_LAYOUT_0X8F);
    expect(screen.getByText('Nothing was installed')).toBeInTheDocument();
    expect(screen.getByText(/This release has no other file for this radio/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enter update mode again with/ })).toBeNull();
  });

  it('is offered once per flash: after the retry, a second refusal offers nothing', async () => {
    show(<Harness image={L2_IMAGE} layoutRetry={{ from: 'L1', to: 'L2' }} />);
    await flashWith({ ...OTHER_LAYOUT_0X8F, image: L2_IMAGE });
    expect(screen.getByText(/refused both of this release's files for it/)).toBeInTheDocument();
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

describe('FlashStep: written / total, elapsed and time left', () => {
  type FlashInput = Parameters<typeof flash.runFirmwareFlash>[0];

  /** Starts a flash that stays running until `finish` is called; `report` feeds progress as the updater would. */
  async function startHeldFlash() {
    let input: FlashInput | null = null;
    let finish: (o: FirmwareFlashOutcome) => void = () => undefined;
    vi.mocked(flash.runFirmwareFlash).mockImplementationOnce((i) => {
      input = i;
      return new Promise((resolve) => {
        finish = resolve;
      });
    });
    if (MINI.preflight?.updateModeConfirm) {
      fireEvent.click(screen.getByLabelText(MINI.preflight.updateModeConfirm));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Connect and flash' }));
    await waitFor(() => expect(input).not.toBeNull());
    return {
      report: (p: Parameters<FlashInput['onProgress']>[0]) => act(() => input!.onProgress(p)),
      finish: (o: FirmwareFlashOutcome) => act(() => finish(o)),
    };
  }

  it('shows elapsed only while no total is known', async () => {
    show(<Harness />);
    const run = await startHeldFlash();
    run.report({ phase: 'handshake', cur: 0, max: 0, msg: 'Handshake', radioTouched: false });
    expect((await screen.findByTestId('firmware-flash-stats')).textContent).toMatch(
      /^0:0\d elapsed$/,
    );
  });

  it('shows the count during the write, then the final count and time', async () => {
    show(<Harness />);
    const run = await startHeldFlash();
    run.report({
      phase: 'transfer',
      cur: 212,
      max: 478,
      msg: 'Sending the firmware',
      radioTouched: true,
      written: { done: 212, total: 478, unit: 'blocks' },
    });
    expect((await screen.findByTestId('firmware-flash-stats')).textContent).toMatch(
      /^212 \/ 478 blocks · 0:0\d elapsed · estimating time left…$/,
    );
    expect(screen.getByText('Sending the firmware')).toBeInTheDocument();

    run.finish({
      ok: true,
      radioId: 'baofeng-uv5rmini',
      image: L1_IMAGE,
      ident: { radioId: 'baofeng-uv5rmini', model: 'UV-5R Mini', raw: new Uint8Array(0) },
      result: { framesSent: 500, dataFrames: 478, elapsedMs: 182_000, end: 'acknowledged' },
      startedAt: 'now',
      written: { done: 478, total: 478, unit: 'blocks' },
    });
    await screen.findByTestId('firmware-flash-summary');
    expect(screen.queryByTestId('firmware-flash-stats')).toBeNull();
    expect(screen.getByText(/478 \/ 478 blocks in 3:02\./)).toBeInTheDocument();
  });

  describe('with a fake clock', () => {
    // Only intervals and the clock are faked; the progress throttle's timeout and testing-library's waits stay real.
    // jsdom runs requestAnimationFrame on an interval while frames are queued (the dialog's open transition), so
    // `settle` lets those frames run: after it, `vi.getTimerCount()` counts the elapsed-time ticker alone.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
      vi.setSystemTime(new Date('2026-01-01T12:00:00Z'));
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    const settle = () =>
      act(() => {
        vi.advanceTimersByTime(100);
      });

    const SUCCESS = {
      ok: true,
      radioId: 'baofeng-uv5rmini',
      image: L1_IMAGE,
      ident: { radioId: 'baofeng-uv5rmini', model: 'UV-5R Mini', raw: new Uint8Array(0) },
      result: { framesSent: 500, dataFrames: 478, elapsedMs: 182_000, end: 'acknowledged' },
      startedAt: 'now',
      written: { done: 478, total: 478, unit: 'blocks' },
    } as const satisfies FirmwareFlashOutcome;

    const transfer = (done: number) =>
      ({
        phase: 'transfer',
        cur: done,
        max: 478,
        msg: 'Sending the firmware',
        radioTouched: true,
        written: { done, total: 478, unit: 'blocks' },
      }) as const;

    it('shows a numeric time left once the warm-up has passed, falling through a silence', async () => {
      show(<Harness />);
      const run = await startHeldFlash();
      settle();
      run.report({ phase: 'erase', cur: 0, max: 478, msg: 'Erasing', radioTouched: true });
      // The first transfer report is the baseline.
      run.report(transfer(10));
      expect((await screen.findByTestId('firmware-flash-stats')).textContent).toMatch(
        /estimating time left…$/,
      );
      act(() => {
        vi.advanceTimersByTime(6_000);
      });
      // 90 blocks in 6 s is 15 blocks/s, and 378 blocks are left: about 25 s.
      run.report(transfer(100));
      await waitFor(() =>
        expect(screen.getByTestId('firmware-flash-stats').textContent).toBe(
          '100 / 478 blocks · 0:06 elapsed · about 0:25 left',
        ),
      );
      // A silence: the ticker moves on, the count stands still, and the time left keeps falling.
      act(() => {
        vi.advanceTimersByTime(3_000);
      });
      expect(screen.getByTestId('firmware-flash-stats').textContent).toBe(
        '100 / 478 blocks · 0:09 elapsed · about 0:22 left',
      );
      await run.finish(SUCCESS);
      await screen.findByTestId('firmware-flash-summary');
    });

    it('clears the ticker when the flash finishes', async () => {
      show(<Harness />);
      const run = await startHeldFlash();
      settle();
      expect(vi.getTimerCount()).toBe(1);
      await run.finish(SUCCESS);
      await screen.findByTestId('firmware-flash-summary');
      settle();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('clears the ticker when the flash fails', async () => {
      show(<Harness />);
      const run = await startHeldFlash();
      settle();
      expect(vi.getTimerCount()).toBe(1);
      await run.finish({
        ...OTHER_LAYOUT_0X8F,
        code: 'protocol',
        message: 'Recover the radio: leave the cable in. (Result 0x83.)',
      });
      await screen.findByTestId('firmware-flash-summary');
      settle();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('clears the ticker when the step unmounts mid-flash', async () => {
      const view = show(<Harness />);
      await startHeldFlash();
      settle();
      expect(vi.getTimerCount()).toBe(1);
      view.unmount();
      expect(vi.getTimerCount()).toBe(0);
    });
  });
});
