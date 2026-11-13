import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useReducer } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LoadedFirmwarePatch } from '@core/firmware/releases/types.ts';
import {
  crc16Xmodem,
  UV5RMINI_ONE_WAY_WARNING,
} from '@core/radios/baofeng/uv-5r-mini/radioReport.ts';
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

vi.mock('../../../services/firmwareFlash.ts', () => ({
  prepareFlash: vi.fn(),
  grantFirmwareRadioReportPort: vi.fn(),
  readFirmwareRadioReport: vi.fn(),
}));

const MINI = getFirmwareUpdater('baofeng-uv5rmini')!;
const DM32 = getFirmwareUpdater('baofeng-dm32uv')!;
const STOCK = { via: 'files' } as unknown as VerifiedStockFirmware;
const LOADED = { provenance: 'published' } as unknown as LoadedFirmwarePatch;
/** The interlock's own words for a crossed pick. */
const OTHER_LAYOUT = 'This file is for the other flash layout; nothing was sent.';
const NO_REPORT =
  'Studio found no MM9PDY radio report: the radio runs stock firmware, or an MM9PDY build from before the report.';

/**
 * A decoded radio report, built like the firmware project's made-up example. `rf0` is made up too: never a real
 * radio's value.
 */
function reportBlock(o: {
  vm?: readonly [number, number];
  bank0?: number;
  v004?: boolean;
  format?: number;
  name?: string;
}): Uint8Array {
  const [vmStart, vmSize] = o.vm ?? [0x94000, 0x6a000];
  const b = new Uint8Array(64);
  b.set([0x4d, 0x4d, 0x39, 0x52, o.format ?? 1, o.v004 ? 1 : 0]);
  const u32 = (at: number, v: number) => {
    for (let i = 0; i < 4; i++) b[at + i] = (v >>> (8 * i)) & 0xff;
  };
  u32(0x08, vmStart);
  u32(0x0c, vmSize);
  u32(0x10, o.bank0 ?? vmStart);
  b.set([0x34, 0x12], 0x14);
  b.set(new TextEncoder().encode(o.name ?? 'mm9pdy-L2-0.2.0-rc.1'), 0x18);
  const crc = crc16Xmodem(b.subarray(0, 0x3e));
  b.set([crc & 0xff, crc >> 8], 0x3e);
  return b;
}
const L1: readonly [number, number] = [0x95000, 0x68000];
const STOCK_FLASH = new Uint8Array(64).fill(0xff);

let latest: FirmwareWizardState;

function Harness({
  updater,
  loaded = LOADED,
}: {
  updater: typeof MINI;
  loaded?: LoadedFirmwarePatch;
}) {
  const [state, dispatch] = useReducer(firmwareWizardReducer, {
    ...INITIAL_FIRMWARE_WIZARD_STATE,
    step: 'prepare',
    radioId: updater.radioId,
    choice: { kind: 'user-patch', file: { name: 'p.json', bytes: new Uint8Array(0) } },
    loadedPatch: loaded,
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

/** Click Read the radio with the read answering `bytes`, or failing with `failure`. */
async function readRadio(answer: Uint8Array | { failure: string }) {
  vi.mocked(flash.readFirmwareRadioReport).mockResolvedValueOnce(
    answer instanceof Uint8Array
      ? { ok: true, bytes: answer }
      : { ok: false, code: 'timeout', message: answer.failure },
  );
  const calls = vi.mocked(flash.readFirmwareRadioReport).mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: /^Read the radio/ }));
  await waitFor(() =>
    expect(vi.mocked(flash.readFirmwareRadioReport).mock.calls.length).toBe(calls + 1),
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /^Read the radio/ })).toBeEnabled(),
  );
}

const lastPrepare = () => vi.mocked(flash.prepareFlash).mock.calls.at(-1)!;

/** An image of whatever layout it is asked for. */
const anyLayout = async (
  _r: unknown,
  _s: unknown,
  _c: unknown,
  _l: unknown,
  radioLayout?: string,
) =>
  ({
    provenance: 'published',
    title: `${radioLayout} build`,
    sha256: {},
    radioLayout,
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

describe('PrepareStep: a release with one file per flash layout', () => {
  const fileFor = (layout: string) =>
    ({ provenance: 'published', layout }) as unknown as LoadedFirmwarePatch;
  const NO_PARTNER =
    'This release has only the L2 file. If the radio refuses it, Studio has no file for the other flash layout to try.';

  it('says so when the release has no file for the other layout', async () => {
    vi.mocked(flash.prepareFlash).mockImplementation(anyLayout);
    render(<Harness updater={MINI} loaded={fileFor('L2')} />);
    await readRadio(reportBlock({}));
    expect(await screen.findByText(/Ready to flash: L2 build/)).toBeInTheDocument();
    expect(screen.getByText(NO_PARTNER)).toBeInTheDocument();
  });

  it('says nothing when the release has both files', async () => {
    vi.mocked(flash.prepareFlash).mockImplementation(anyLayout);
    render(<Harness updater={MINI} loaded={{ ...fileFor('L1'), otherLayouts: [fileFor('L2')] }} />);
    await readRadio(reportBlock({}));
    expect(await screen.findByText(/Ready to flash: L2 build/)).toBeInTheDocument();
    expect(screen.queryByText(/has no file for the other flash layout/)).toBeNull();
  });
});

describe('PrepareStep: reading the UV-5R Mini', () => {
  it('reads the radio first, and asks nothing and prepares nothing before it', () => {
    render(<Harness updater={MINI} />);
    expect(screen.getByRole('button', { name: 'Read the radio' })).toBeInTheDocument();
    expect(screen.getByText(/The read writes nothing/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Radio Info: Firmware')).toBeNull();
    expect(screen.queryByText(/Preparing/)).toBeNull();
    expect(flash.readFirmwareRadioReport).not.toHaveBeenCalled();
    expect(flash.prepareFlash).not.toHaveBeenCalled();
    expect(canAdvance(latest)).toBe(false);
  });

  it('a report for L2 asks no question and prepares the L2 file with the build name', async () => {
    render(<Harness updater={MINI} />);
    await readRadio(reportBlock({}));
    expect(flash.readFirmwareRadioReport).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Radio Info: Firmware')).toBeNull();
    expect(screen.getByText('MM9PDY build: mm9pdy-L2-0.2.0-rc.1')).toBeInTheDocument();
    expect(screen.getByText('RF chip register 0: 0x1234')).toBeInTheDocument();
    expect(await screen.findByText(/Ready to flash: L2 build/)).toBeInTheDocument();
    expect(lastPrepare()[4]).toBe('L2');
    expect(lastPrepare()[5]).toBe('mm9pdy-L2-0.2.0-rc.1');
    expect(screen.queryByText(UV5RMINI_ONE_WAY_WARNING)).toBeNull();
    expect(canAdvance(latest)).toBe(true);
  });

  it('a report with an empty name is prepared as reported, with no build name', async () => {
    render(<Harness updater={MINI} />);
    await readRadio(reportBlock({ name: '' }));
    expect(await screen.findByText(/Ready to flash: L2 build/)).toBeInTheDocument();
    expect(lastPrepare()[4]).toBe('L2');
    expect(lastPrepare()[5]).toBeUndefined();
    expect(lastPrepare()[7]).toBe(true);
  });

  it('a report for L1 on the v0.04 code base shows the one-way warning and picks L1', async () => {
    vi.mocked(flash.prepareFlash).mockImplementation(anyLayout);
    render(<Harness updater={MINI} />);
    await readRadio(reportBlock({ vm: L1, v004: true, name: 'mm9pdy-L1-0.2.0' }));
    expect(screen.getByText(UV5RMINI_ONE_WAY_WARNING)).toBeInTheDocument();
    expect(await screen.findByText(/Ready to flash: L1 build/)).toBeInTheDocument();
    expect(lastPrepare()[4]).toBe('L1');
    expect(canAdvance(latest)).toBe(true);
  });

  it('a report for L1 on the v0.27 code base shows no one-way warning', async () => {
    vi.mocked(flash.prepareFlash).mockImplementation(anyLayout);
    render(<Harness updater={MINI} />);
    await readRadio(reportBlock({ vm: L1, name: 'mm9pdy-L1-0.2.0' }));
    expect(await screen.findByText(/Ready to flash: L1 build/)).toBeInTheDocument();
    expect(screen.queryByText(UV5RMINI_ONE_WAY_WARNING)).toBeNull();
  });

  it('a crossed pick from the report is refused before Connect', async () => {
    render(<Harness updater={MINI} />);
    await readRadio(reportBlock({ vm: L1, name: 'mm9pdy-L1-0.2.0' }));
    expect(
      await screen.findByText(new RegExp(OTHER_LAYOUT.replace(/[.;]/g, '.'))),
    ).toBeInTheDocument();
    expect(lastPrepare()[4]).toBe('L1');
    expect(latest.image).toBeNull();
    expect(canAdvance(latest)).toBe(false);
  });

  it('shows a vm_bank0 mismatch and still decides on the VM pair', async () => {
    render(<Harness updater={MINI} />);
    await readRadio(reportBlock({ bank0: 0x95000 }));
    expect(screen.getByText(/settings store starts at 0x95000/)).toBeInTheDocument();
    expect(await screen.findByText(/Ready to flash: L2 build/)).toBeInTheDocument();
  });

  it('refuses an unsupported VM pair and builds nothing', async () => {
    render(<Harness updater={MINI} />);
    await readRadio(reportBlock({ vm: [0x96000, 0x66000] }));
    expect(
      screen.getByText(
        "This radio reports a flash layout Studio doesn't support (VM entry at 0x96000, 0x66000 bytes). Nothing was sent.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Radio Info: Firmware')).toBeNull();
    expect(flash.prepareFlash).not.toHaveBeenCalled();
    expect(canAdvance(latest)).toBe(false);
  });

  it('refuses an unknown report format by name and builds nothing', async () => {
    render(<Harness updater={MINI} />);
    await readRadio(reportBlock({ format: 2 }));
    expect(screen.getByText(/answers in report format 2/)).toBeInTheDocument();
    expect(flash.prepareFlash).not.toHaveBeenCalled();
  });

  it('a same-build report asks for the explicit confirm', async () => {
    const WARNING =
      'This radio already runs mm9pdy-L2-0.2.0-rc.1. Writing it again rewrites the same firmware; use this to repair a radio. The usual power-cut risk applies.';
    vi.mocked(flash.prepareFlash).mockImplementation(
      async (_r, _s, _c, _l, radioLayout, radioBuild, reinstallConfirmed) => {
        if (radioBuild === 'mm9pdy-L2-0.2.0-rc.1' && !reinstallConfirmed) {
          throw new RadioConfirmRequiredError(WARNING);
        }
        return {
          provenance: 'published',
          title: 'L2 build',
          sha256: {},
          radioLayout,
        } as unknown as PreparedFirmwareImage;
      },
    );
    render(<Harness updater={MINI} />);
    await readRadio(reportBlock({}));
    expect(await screen.findByText(WARNING)).toBeInTheDocument();
    expect(canAdvance(latest)).toBe(false);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Write it again anyway' }));
    expect(await screen.findByText(/Ready to flash: L2 build/)).toBeInTheDocument();
    expect(canAdvance(latest)).toBe(true);
  });

  it('reading again drops the prepared image and the confirm', async () => {
    vi.mocked(flash.prepareFlash).mockImplementation(
      async (_r, _s, _c, _l, radioLayout, radioBuild, reinstallConfirmed) => {
        if (radioBuild !== undefined && !reinstallConfirmed) {
          throw new RadioConfirmRequiredError('This radio already runs it.');
        }
        return anyLayout(_r, _s, _c, _l, radioLayout);
      },
    );
    render(<Harness updater={MINI} />);
    await readRadio(reportBlock({}));
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Write it again anyway' }));
    await screen.findByText(/Ready to flash: L2 build/);
    expect(latest.reinstallConfirmed).toBe(true);
    expect(latest.image).not.toBeNull();
    await readRadio(STOCK_FLASH);
    expect(latest.image).toBeNull();
    expect(latest.reinstallConfirmed).toBe(false);
    expect(screen.getByText(NO_REPORT)).toBeInTheDocument();
    expect(screen.getByLabelText('Radio Info: Firmware')).toBeInTheDocument();
  });
});

describe('PrepareStep: the UV-5R Mini Radio Info question, with no report', () => {
  it('a stock radio is asked the Firmware and Hardware lines, and only those', async () => {
    render(<Harness updater={MINI} />);
    await readRadio(STOCK_FLASH);
    expect(screen.getByText(NO_REPORT)).toBeInTheDocument();
    expect(screen.getByLabelText('Radio Info: Firmware')).toBeInTheDocument();
    expect(screen.getByLabelText('Radio Info: Hardware')).toBeInTheDocument();
    expect(screen.queryByLabelText(/MM9PDY build/)).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText(/hardware layout/i)).toBeNull();
    expect(screen.getByText(/Enter both Radio Info lines/)).toBeInTheDocument();
    expect(flash.prepareFlash).not.toHaveBeenCalled();
  });

  it('stock V0.27 is L2, prepared with no build name', async () => {
    render(<Harness updater={MINI} />);
    await readRadio(STOCK_FLASH);
    radioInfo('V0.27', 'V1.7');
    expect(await screen.findByText(/Ready to flash: L2 build/)).toBeInTheDocument();
    expect(lastPrepare()[4]).toBe('L2');
    expect(lastPrepare()[5]).toBeUndefined();
    expect(lastPrepare()[7]).toBe(false);
    expect(screen.getByText('Flash layout: L2')).toBeInTheDocument();
    expect(canAdvance(latest)).toBe(true);
  });

  it('stock V0.04 is L1, with no one-way warning; an L2 file is refused before Connect', async () => {
    render(<Harness updater={MINI} />);
    await readRadio(STOCK_FLASH);
    radioInfo('V0.04', 'V1.7');
    expect(
      await screen.findByText(new RegExp(OTHER_LAYOUT.replace(/[.;]/g, '.'))),
    ).toBeInTheDocument();
    expect(lastPrepare()[4]).toBe('L1');
    expect(screen.queryByText(UV5RMINI_ONE_WAY_WARNING)).toBeNull();
    expect(latest.image).toBeNull();
    expect(canAdvance(latest)).toBe(false);
    expect(screen.queryByRole('button', { name: 'Connect and flash' })).toBeNull();
  });

  it('refuses a Hardware line not proven, without building anything', async () => {
    render(<Harness updater={MINI} />);
    await readRadio(STOCK_FLASH);
    radioInfo('V0.27', 'V1.8');
    expect(
      screen.getByText(
        "Studio hasn't been proven on this radio's Hardware version; nothing was sent.",
      ),
    ).toBeInTheDocument();
    expect(flash.prepareFlash).not.toHaveBeenCalled();
    expect(canAdvance(latest)).toBe(false);
  });

  it('a failed read says why and falls back to the question', async () => {
    render(<Harness updater={MINI} />);
    await readRadio({ failure: 'The radio did not answer.' });
    expect(
      screen.getByText(/Studio couldn't read the radio: The radio did not answer\./),
    ).toBeInTheDocument();
    radioInfo('V0.27', 'V1.7');
    expect(await screen.findByText(/Ready to flash: L2 build/)).toBeInTheDocument();
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
    await readRadio(STOCK_FLASH);
    radioInfo('V0.27', 'V1.7');
    await screen.findByText('This radio may run it.');
    expect(
      screen.getByText('Nothing is sent to the radio unless you confirm.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Write it again anyway' }));
    await screen.findByText(/Ready to flash/);
    type('Radio Info: Firmware', 'V0.04');
    await waitFor(() => expect(latest.reinstallConfirmed).toBe(false));
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
