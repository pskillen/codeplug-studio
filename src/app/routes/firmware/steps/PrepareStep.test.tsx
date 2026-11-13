import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useReducer } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LoadedFirmwarePatch } from '@core/firmware/releases/types.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';
import {
  getFirmwareUpdater,
  RadioConfirmRequiredError,
  RadioInterlockError,
} from '@integrations/radio-io';

import { DesignSystemV2Provider } from '../../../components/v2/index.ts';
import * as flash from '../../../services/firmwareFlash.ts';
import type { VerifiedStockFirmware } from '../../../services/firmwareFlash.ts';
import {
  canAdvance,
  firmwareWizardReducer,
  INITIAL_FIRMWARE_WIZARD_STATE,
  type FirmwareWizardState,
} from '../firmwareWizardState.ts';
import PrepareStep from './PrepareStep.tsx';

vi.mock('../../../services/firmwareFlash.ts', () => ({ prepareFlash: vi.fn() }));

const MINI = getFirmwareUpdater('baofeng-uv5rmini')!;
const DM32 = getFirmwareUpdater('baofeng-dm32uv')!;
const STOCK = { via: 'files' } as unknown as VerifiedStockFirmware;
const LOADED = { provenance: 'published' } as unknown as LoadedFirmwarePatch;
/** The interlock's own words for a crossed pick. */
const OTHER_LAYOUT = 'This file is for the other flash layout; nothing was sent.';

let latest: FirmwareWizardState;

function Harness({ updater }: { updater: typeof MINI }) {
  const [state, dispatch] = useReducer(firmwareWizardReducer, {
    ...INITIAL_FIRMWARE_WIZARD_STATE,
    step: 'prepare',
    radioId: updater.radioId,
    choice: { kind: 'user-patch', file: { name: 'p.json', bytes: new Uint8Array(0) } },
    loadedPatch: LOADED,
    stock: STOCK,
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

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const radioInfo = (firmware: string, hardware: string) => {
  type('Radio Info: Firmware', firmware);
  type('Radio Info: Hardware', hardware);
};

describe('PrepareStep: the UV-5R Mini Radio Info question', () => {
  beforeEach(() => {
    vi.mocked(flash.prepareFlash).mockReset();
    // An L2 file: the image interlock refuses any other layout, as `checkUv5rMiniImage` does for an L2 loader.
    vi.mocked(flash.prepareFlash).mockImplementation(
      async (_r, _s, _c, _l, radioLayout?: string) => {
        if (radioLayout !== 'L2') throw new RadioInterlockError(OTHER_LAYOUT);
        return {
          provenance: 'published',
          title: 'L2 build',
          sha256: {},
          radioLayout,
        } as unknown as PreparedFirmwareImage;
      },
    );
  });

  it('asks only the Firmware and Hardware lines', () => {
    render(<Harness updater={MINI} />);
    expect(screen.getByLabelText('Radio Info: Firmware')).toBeInTheDocument();
    expect(screen.getByLabelText('Radio Info: Hardware')).toBeInTheDocument();
    expect(screen.queryByLabelText(/MM9PDY build/)).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText(/hardware layout/i)).toBeNull();
  });

  it('prepares nothing until both lines are entered', () => {
    render(<Harness updater={MINI} />);
    expect(screen.getByText(/Enter both Radio Info lines/)).toBeInTheDocument();
    type('Radio Info: Firmware', 'V0.27');
    expect(flash.prepareFlash).not.toHaveBeenCalled();
  });

  it('refuses a Hardware line not proven, without building anything', () => {
    render(<Harness updater={MINI} />);
    radioInfo('V0.27', 'V1.8');
    expect(
      screen.getByText(
        "Studio hasn't been proven on this radio's Hardware version; nothing was sent.",
      ),
    ).toBeInTheDocument();
    expect(flash.prepareFlash).not.toHaveBeenCalled();
    expect(canAdvance(latest)).toBe(false);
  });

  it('maps stock V0.27 to L2 and prepares the image with it', async () => {
    render(<Harness updater={MINI} />);
    radioInfo('V0.27', 'V1.7');
    expect(await screen.findByText(/Ready to flash: L2 build/)).toBeInTheDocument();
    expect(vi.mocked(flash.prepareFlash).mock.calls.at(-1)![4]).toBe('L2');
    // No build name from the radio: "already installed" has nothing to compare.
    expect(vi.mocked(flash.prepareFlash).mock.calls.at(-1)![5]).toBeUndefined();
    expect(screen.getByText('Flash layout: L2')).toBeInTheDocument();
    expect(canAdvance(latest)).toBe(true);
  });

  it('maps stock V0.04 to L1, with no one-way warning, and refuses an L2 file before Connect', async () => {
    render(<Harness updater={MINI} />);
    radioInfo('V0.04', 'V1.7');
    expect(
      await screen.findByText(new RegExp(OTHER_LAYOUT.replace(/[.;]/g, '.'))),
    ).toBeInTheDocument();
    expect(vi.mocked(flash.prepareFlash).mock.calls.at(-1)![4]).toBe('L1');
    expect(screen.queryByText(/for good/)).toBeNull();
    await waitFor(() => expect(latest.image).toBeNull());
    // No image: the wizard cannot move on to the update-mode and flash steps, so nothing is ever sent.
    expect(canAdvance(latest)).toBe(false);
    expect(screen.queryByRole('button', { name: 'Connect and flash' })).toBeNull();
  });

  it('shows a same-build warning with an explicit confirm, and builds nothing until it is ticked', async () => {
    const WARNING =
      'Studio sees no MM9PDY build on this radio, so it may already run the stock nrf-v0.27. Writing it again rewrites the same firmware; use this to repair a radio. The usual power-cut risk applies.';
    vi.mocked(flash.prepareFlash).mockImplementation(
      async (_r, _s, _c, _l, radioLayout, _b, reinstallConfirmed) => {
        if (!reinstallConfirmed) throw new RadioConfirmRequiredError(WARNING);
        return {
          provenance: 'published',
          title: 'L2 build',
          sha256: {},
          radioLayout,
          reinstallConfirmed: true,
        } as unknown as PreparedFirmwareImage;
      },
    );
    render(<Harness updater={MINI} />);
    radioInfo('V0.27', 'V1.7');
    expect(await screen.findByText(WARNING)).toBeInTheDocument();
    expect(
      screen.getByText('Nothing is sent to the radio unless you confirm.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Preparing/)).toBeNull();
    expect(vi.mocked(flash.prepareFlash).mock.calls.at(-1)![6]).toBe(false);
    // Not prepared: the wizard can't reach the update-mode and flash steps, so nothing is sent.
    expect(latest.image).toBeNull();
    expect(canAdvance(latest)).toBe(false);

    const confirm = screen.getByRole('checkbox', { name: 'Write it again anyway' });
    fireEvent.click(confirm);
    expect(await screen.findByText(/Ready to flash: L2 build/)).toBeInTheDocument();
    expect(vi.mocked(flash.prepareFlash).mock.calls.at(-1)![6]).toBe(true);
    expect(latest.reinstallConfirmed).toBe(true);
    expect(canAdvance(latest)).toBe(true);
    // The warning stays in view, ticked, so the operator can take it back.
    expect(screen.getByText(WARNING)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Write it again anyway' }));
    await waitFor(() => expect(latest.image).toBeNull());
    expect(
      await screen.findByText('Nothing is sent to the radio unless you confirm.'),
    ).toBeInTheDocument();
    expect(canAdvance(latest)).toBe(false);
  });

  it('drops the confirm when the Radio Info answers change', async () => {
    vi.mocked(flash.prepareFlash).mockImplementation(
      async (_r, _s, _c, _l, radioLayout, _b, reinstallConfirmed) => {
        if (!reinstallConfirmed) throw new RadioConfirmRequiredError('This radio may run it.');
        return {
          provenance: 'published',
          title: 'L2 build',
          sha256: {},
          radioLayout,
        } as unknown as PreparedFirmwareImage;
      },
    );
    render(<Harness updater={MINI} />);
    radioInfo('V0.27', 'V1.7');
    await screen.findByText('This radio may run it.');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Write it again anyway' }));
    await screen.findByText(/Ready to flash/);
    type('Radio Info: Firmware', 'V0.04');
    await waitFor(() => expect(latest.reinstallConfirmed).toBe(false));
  });

  it('asks nothing for a radio with one layout', async () => {
    vi.mocked(flash.prepareFlash).mockResolvedValue({
      provenance: 'published',
      title: 'DM build',
      sha256: {},
    } as unknown as PreparedFirmwareImage);
    render(<Harness updater={DM32} />);
    expect(screen.queryByLabelText('Radio Info: Firmware')).toBeNull();
    expect(await screen.findByText(/Ready to flash: DM build/)).toBeInTheDocument();
    expect(vi.mocked(flash.prepareFlash).mock.calls[0]![4]).toBeUndefined();
  });
});
