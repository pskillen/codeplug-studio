import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useReducer } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LoadedFirmwarePatch } from '@core/firmware/releases/types.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';
import { getFirmwareUpdater, RadioInterlockError } from '@integrations/radio-io';

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
const OTHER_LAYOUT = 'This file is for the other hardware layout; nothing was sent.';

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

  it('prepares nothing until both lines are entered', () => {
    render(<Harness updater={MINI} />);
    expect(screen.getByText(/Enter both Radio Info lines/)).toBeInTheDocument();
    expect(flash.prepareFlash).not.toHaveBeenCalled();
  });

  it('refuses an unknown pair without building anything', () => {
    render(<Harness updater={MINI} />);
    type('Radio Info: Firmware', 'V0.30');
    type('Radio Info: Hardware', 'V1.7');
    expect(
      screen.getByText("Studio doesn't recognise this radio's Radio Info; nothing was sent."),
    ).toBeInTheDocument();
    expect(flash.prepareFlash).not.toHaveBeenCalled();
    expect(canAdvance(latest)).toBe(false);
  });

  it('maps V0.27 / V1.7 to L2 and prepares the image with it', async () => {
    render(<Harness updater={MINI} />);
    type('Radio Info: Firmware', 'V0.27');
    type('Radio Info: Hardware', 'V1.7');
    expect(await screen.findByText(/Ready to flash: L2 build/)).toBeInTheDocument();
    expect(vi.mocked(flash.prepareFlash).mock.calls.at(-1)![4]).toBe('L2');
    expect(screen.getByText('Hardware layout: L2')).toBeInTheDocument();
    expect(canAdvance(latest)).toBe(true);
  });

  it('refuses a crossed pick before Connect: the override makes the radio L1, the file is L2', async () => {
    render(<Harness updater={MINI} />);
    type('Radio Info: Firmware', 'V0.27');
    type('Radio Info: Hardware', 'V1.7');
    await screen.findByText(/Ready to flash/);
    fireEvent.click(screen.getByRole('checkbox', { name: /My radio is layout 1/ }));
    expect(
      await screen.findByText(new RegExp(OTHER_LAYOUT.replace(/[.;]/g, '.'))),
    ).toBeInTheDocument();
    expect(vi.mocked(flash.prepareFlash).mock.calls.at(-1)![4]).toBe('L1');
    await waitFor(() => expect(latest.image).toBeNull());
    // No image: the wizard cannot move on to the update-mode and flash steps, so nothing is ever sent.
    expect(canAdvance(latest)).toBe(false);
    expect(screen.queryByRole('button', { name: 'Connect and flash' })).toBeNull();
  });

  it('refuses a crossed pick before Connect: the build name says L1, the file is L2', async () => {
    render(<Harness updater={MINI} />);
    type('Radio Info: Firmware', 'V0.27');
    type('Radio Info: Hardware', 'V1.7');
    await screen.findByText(/Ready to flash/);
    type('Radio Info: MM9PDY build (if shown)', 'mm9pdy-L1-1.0.0');
    expect(
      await screen.findByText(new RegExp(OTHER_LAYOUT.replace(/[.;]/g, '.'))),
    ).toBeInTheDocument();
    expect(vi.mocked(flash.prepareFlash).mock.calls.at(-1)![4]).toBe('L1');
    await waitFor(() => expect(latest.image).toBeNull());
    expect(canAdvance(latest)).toBe(false);
    expect(screen.queryByRole('button', { name: 'Connect and flash' })).toBeNull();
  });

  it('prepares an L2 file for a radio whose build name says L2', async () => {
    render(<Harness updater={MINI} />);
    type('Radio Info: Firmware', 'V0.27');
    type('Radio Info: Hardware', 'V1.7');
    type('Radio Info: MM9PDY build (if shown)', 'mm9pdy-L2-pr140-g1c0a');
    expect(await screen.findByText(/Ready to flash: L2 build/)).toBeInTheDocument();
    expect(vi.mocked(flash.prepareFlash).mock.calls.at(-1)![4]).toBe('L2');
  });

  it('passes the typed build name (trimmed) to the image, so "already installed" can refuse it', async () => {
    render(<Harness updater={MINI} />);
    type('Radio Info: Firmware', 'V0.27');
    type('Radio Info: Hardware', 'V1.7');
    type('Radio Info: MM9PDY build (if shown)', ' mm9pdy-L2-pr140-g1c0a ');
    await screen.findByText(/Ready to flash: L2 build/);
    expect(vi.mocked(flash.prepareFlash).mock.calls.at(-1)![5]).toBe('mm9pdy-L2-pr140-g1c0a');
  });

  it('shows the already-installed refusal from the interlock and builds no Connect step', async () => {
    vi.mocked(flash.prepareFlash).mockRejectedValue(
      new Error(
        'Radio Info says this radio already runs mm9pdy-L2-pr140-g1c0a. This firmware is already installed; nothing was sent. Flash a different build.',
      ),
    );
    render(<Harness updater={MINI} />);
    type('Radio Info: Firmware', 'V0.27');
    type('Radio Info: Hardware', 'V1.7');
    type('Radio Info: MM9PDY build (if shown)', 'mm9pdy-L2-pr140-g1c0a');
    expect(await screen.findByText(/already installed; nothing was sent/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Connect and flash' })).toBeNull();
  });

  it('refuses a build name outside the grammar without building anything', () => {
    render(<Harness updater={MINI} />);
    type('Radio Info: MM9PDY build (if shown)', 'mm9pdy-L3-1.0.0');
    type('Radio Info: Firmware', 'V0.27');
    type('Radio Info: Hardware', 'V1.7');
    expect(
      screen.getByText("Studio doesn't recognise this radio's Radio Info; nothing was sent."),
    ).toBeInTheDocument();
    expect(flash.prepareFlash).not.toHaveBeenCalled();
  });

  it('warns that a wrong override resets the FM presets and volume', () => {
    render(<Harness updater={MINI} />);
    expect(screen.getByText(/FM presets and volume are reset/)).toBeInTheDocument();
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
