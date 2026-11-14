import { fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useReducer } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LoadedFirmwarePatch } from '@core/firmware/releases/types.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';
import { getFirmwareUpdater, RadioInterlockError } from '@integrations/radio-io';

import { DEVELOPER_MODE_KEY, setDeveloperMode } from '@integrations/preferences/developerMode.ts';

import { DesignSystemV2Provider } from '../../../components/v2/index.ts';
import * as flash from '../../../services/firmwareFlash.ts';
import type { VerifiedStockFirmware } from '../../../services/firmwareFlash.ts';
import {
  canAdvance,
  firmwareWizardReducer,
  INITIAL_FIRMWARE_WIZARD_STATE,
  type FirmwareWizardState,
} from '../firmwareWizardState.ts';
import { radioCheckSetup } from '../radioCheck.ts';
import PrepareStep from './PrepareStep.tsx';

vi.mock('../../../services/firmwareFlash.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof flash>();
  return {
    noFileForRadioMessage: actual.noFileForRadioMessage,
    releaseHasFileForLayout: actual.releaseHasFileForLayout,
    prepareFlash: vi.fn(),
    grantFirmwareRadioReportPort: vi.fn(),
    readFirmwareRadioReport: vi.fn(),
  };
});

const MINI = getFirmwareUpdater('baofeng-uv5rmini')!;
const DM32 = getFirmwareUpdater('baofeng-dm32uv')!;
const STOCK = { via: 'files' } as unknown as VerifiedStockFirmware;
const LOADED = { provenance: 'published' } as unknown as LoadedFirmwarePatch;
/** The interlock's own words for a crossed pick. */
const OTHER_LAYOUT = "This file isn't for this radio's firmware; nothing was sent.";

let latest: FirmwareWizardState;

function Harness({
  updater,
  loaded = LOADED,
  start = {},
}: {
  updater: typeof MINI;
  loaded?: LoadedFirmwarePatch;
  start?: Partial<FirmwareWizardState>;
}) {
  const [state, dispatch] = useReducer(firmwareWizardReducer, {
    ...INITIAL_FIRMWARE_WIZARD_STATE,
    step: 'prepare',
    radioId: updater.radioId,
    radioCheck: radioCheckSetup(updater),
    choice: { kind: 'user-patch', file: { name: 'p.json', bytes: new Uint8Array(0) } },
    loadedPatch: loaded,
    stock: STOCK,
    ...start,
  } satisfies FirmwareWizardState);
  useEffect(() => {
    latest = state;
  }, [state]);
  return (
    <DesignSystemV2Provider>
      <PrepareStep state={state} dispatch={dispatch} updater={updater} />
    </DesignSystemV2Provider>
  );
}

const lastPrepare = () => vi.mocked(flash.prepareFlash).mock.calls.at(-1)!;

/** An image of whatever layout it is asked for, on the radio's base where it has one. */
const anyLayout = async (
  _r: unknown,
  _s: unknown,
  _c: unknown,
  _l: unknown,
  radioLayout?: string,
  _b?: unknown,
  _rc?: unknown,
  _rr?: unknown,
  radioCodeBase?: string,
) =>
  ({
    provenance: 'published',
    title: `${radioLayout} build`,
    sha256: {},
    radioLayout,
    ...(radioCodeBase ? { baseName: radioCodeBase } : {}),
  }) as unknown as PreparedFirmwareImage;

beforeEach(() => {
  vi.mocked(flash.prepareFlash).mockReset();
  vi.mocked(flash.readFirmwareRadioReport).mockReset();
  vi.mocked(flash.grantFirmwareRadioReportPort).mockReset();
  vi.mocked(flash.grantFirmwareRadioReportPort).mockResolvedValue(
    {} as Awaited<ReturnType<typeof flash.grantFirmwareRadioReportPort>>,
  );
  // An L2 file: the image interlock refuses any other layout, as `checkUv5rMiniImage` does for an L2 loader.
  vi.mocked(flash.prepareFlash).mockImplementation(async (_r, _s, _c, _l, radioLayout?: string) => {
    if (radioLayout !== 'L2') throw new RadioInterlockError(OTHER_LAYOUT);
    return {
      provenance: 'published',
      title: 'L2 build',
      sha256: {},
      radioLayout,
    } as unknown as PreparedFirmwareImage;
  });
});

describe('PrepareStep: after the radio refused one layout before installing anything', () => {
  it("prepares the other layout's file, says why, and runs the checks for it", async () => {
    vi.mocked(flash.prepareFlash).mockImplementation(anyLayout);
    render(
      <Harness
        updater={MINI}
        start={{
          radioRead: {
            kind: 'report',
            answer: { kind: 'layout', layout: 'L1', reported: true },
          },
          layoutRetry: { from: 'L1', to: 'L2' },
        }}
      />,
    );
    expect(
      screen.getByText(
        "The radio refused the first file before installing anything, so Studio prepares this release's other file for it.",
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Ready to flash: L2 build/)).toBeInTheDocument();
    expect(lastPrepare()[4]).toBe('L2');
  });

  it('with developer mode on, the retry banner names the refused and the next flash layout', async () => {
    setDeveloperMode(true);
    try {
      vi.mocked(flash.prepareFlash).mockImplementation(anyLayout);
      render(
        <Harness
          updater={MINI}
          start={{
            radioRead: {
              kind: 'report',
              answer: { kind: 'layout', layout: 'L1', reported: true },
            },
            layoutRetry: { from: 'L1', to: 'L2' },
          }}
        />,
      );
      expect(
        screen.getByText(
          "The radio refused the first file before installing anything, so Studio prepares this release's other file for it (L1 refused, L2 next).",
        ),
      ).toBeInTheDocument();
      expect(await screen.findByText(/Ready to flash: L2 build/)).toBeInTheDocument();
      expect(lastPrepare()[4]).toBe('L2');
    } finally {
      localStorage.removeItem(DEVELOPER_MODE_KEY);
    }
  });

  it("a stock radio's retry is prepared on the partner file's base, not the answered one", async () => {
    vi.mocked(flash.prepareFlash).mockImplementation(anyLayout);
    render(
      <Harness
        updater={MINI}
        start={{
          radioRead: { kind: 'none' },
          radioInfo: { firmware: 'V0.27', suffix: 'NRF', hardware: 'V1.7' },
          layoutRetry: { from: 'L2', to: 'L1', toBase: 'nrf-v0.04' },
        }}
      />,
    );
    expect(await screen.findByText(/Ready to flash: L1 build/)).toBeInTheDocument();
    expect(lastPrepare()[4]).toBe('L1');
    expect(lastPrepare()[8]).toBe('nrf-v0.04');
  });
});

describe('PrepareStep: a radio with one layout', () => {
  it('asks nothing and reads nothing', async () => {
    vi.mocked(flash.prepareFlash).mockResolvedValue({
      provenance: 'published',
      title: 'DM build',
      sha256: {},
    } as unknown as PreparedFirmwareImage);
    render(<Harness updater={DM32} />);
    expect(screen.queryByLabelText('Radio Info: Firmware')).toBeNull();
    expect(screen.queryByRole('button', { name: /Read the radio/ })).toBeNull();
    expect(await screen.findByText(/Ready to flash: DM build/)).toBeInTheDocument();
    expect(lastPrepare()[4]).toBeUndefined();
  });
});

describe('PrepareStep: the radio check, read-only (#1670)', () => {
  it("shows the radio's report, and neither reads nor asks", async () => {
    render(
      <Harness
        updater={MINI}
        start={{
          radioRead: {
            kind: 'report',
            answer: {
              kind: 'layout',
              layout: 'L2',
              reported: true,
              details: ['MM9PDY build: mm9pdy-L2-0.2.0-rc.1'],
            },
          },
        }}
      />,
    );
    expect(screen.getByText('Your radio, as it reported itself:')).toBeInTheDocument();
    expect(screen.getByText('MM9PDY build: mm9pdy-L2-0.2.0-rc.1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Read the radio/ })).toBeNull();
    expect(screen.queryByLabelText('Radio Info: Firmware')).toBeNull();
    expect(await screen.findByText(/Ready to flash: L2 build/)).toBeInTheDocument();
    expect(lastPrepare()[4]).toBe('L2');
  });

  it('shows the Radio Info answers as text, and goes back to the check step to change them', async () => {
    render(
      <Harness
        updater={MINI}
        start={{
          radioRead: { kind: 'none' },
          radioInfo: { firmware: 'V0.27', suffix: 'NRF', hardware: 'V1.7' },
        }}
      />,
    );
    expect(screen.getByText('Your radio, as you answered:')).toBeInTheDocument();
    expect(screen.getByText('Radio Info: Firmware: V0.27')).toBeInTheDocument();
    expect(screen.getByText('Suffix: NRF')).toBeInTheDocument();
    expect(screen.getByText('Radio Info: Hardware: V1.7')).toBeInTheDocument();
    expect(screen.queryByLabelText('Radio Info: Firmware')).toBeNull();
    expect(await screen.findByText(/Ready to flash: L2 build/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check your radio again' }));
    expect(latest.step).toBe('check');
  });

  it('still prepares nothing without an answer, whatever the step before let through', () => {
    render(<Harness updater={MINI} start={{ radioRead: { kind: 'none' } }} />);
    expect(
      screen.getByText('Studio needs to know about your radio before it prepares the image.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Preparing/)).toBeNull();
    expect(flash.prepareFlash).not.toHaveBeenCalled();
    expect(canAdvance(latest)).toBe(false);
  });

  it('still refuses an unsupported answer, and a release with no file for the radio', () => {
    const l2Only = {
      provenance: 'published',
      layout: 'L2',
      parsed: { description: { base: 'nrf-v0.27' } },
    } as unknown as LoadedFirmwarePatch;
    const { unmount } = render(
      <Harness
        updater={MINI}
        start={{
          radioRead: { kind: 'none' },
          radioInfo: { firmware: 'V0.04', suffix: 'NRF', hardware: 'V1.7' },
        }}
      />,
    );
    expect(
      screen.getByText(
        'There is no MM9PDY build for this radio (NRF V0.04) yet; nothing was sent.',
      ),
    ).toBeInTheDocument();
    unmount();
    render(
      <Harness
        updater={MINI}
        loaded={l2Only}
        start={{
          radioRead: { kind: 'none' },
          radioInfo: { firmware: 'V0.04', suffix: 'NRFB', hardware: 'V1.7' },
        }}
      />,
    );
    expect(screen.getByText(/^Not available in this release/)).toBeInTheDocument();
    expect(flash.prepareFlash).not.toHaveBeenCalled();
    expect(canAdvance(latest)).toBe(false);
  });
});
