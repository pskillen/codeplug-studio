import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MD9600_RADIOFOUNDRY_CABLE_BOARD } from '@integrations/radio-io/radios/radiofoundry/board.ts';
import { FakeRadioFoundryRadio } from '@integrations/radio-io/radios/radiofoundry/__fixtures__/fakeRadioFoundryRadio.ts';
import { RADIOFOUNDRY_DEBUG_AREA2_OPTION } from '@integrations/radio-io/radios/radiofoundry/debugText.ts';
import { RADIOFOUNDRY_REGION } from '@integrations/radio-io/radios/radiofoundry/debugCapture.ts';
import { BLOCK_SIZE } from '@integrations/radio-io/radios/radiofoundry/constants.ts';
import { DMR_ID_DATABASE_AREA2_ADDRESS } from '@integrations/radio-io/radios/radiofoundry/idDatabase.ts';
import { captureRadioFoundry } from './radioFoundryCapture.ts';

function versionTextFor(board: typeof MD9600_RADIOFOUNDRY_CABLE_BOARD): string {
  return `proto=1\ngit=454a5b76\nboard=${board.versionBoardNames[0]}\nfeatures=\n`;
}

function fakePipe() {
  return new FakeRadioFoundryRadio({
    imageEnd: MD9600_RADIOFOUNDRY_CABLE_BOARD.limits.IMAGE_END,
    physicalBase: MD9600_RADIOFOUNDRY_CABLE_BOARD.limits.PHYSICAL_CODEPLUG_BASE,
    versionText: versionTextFor(MD9600_RADIOFOUNDRY_CABLE_BOARD),
  });
}

const transport = vi.hoisted(() => ({
  native: false,
  pipe: undefined as undefined | import('@integrations/radio-io/types.ts').BytePipe,
  baud: [] as (number | undefined)[],
}));
vi.mock('@integrations/radio-io/transport/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@integrations/radio-io/transport/index.ts')>()),
  isCapacitorSerialSupported: () => transport.native,
  requestCapacitorSerialPort: vi.fn(async () => ({})),
  openCapacitorSerialPipe: vi.fn(async (device: unknown, baud?: number) => {
    transport.baud.push(baud);
    return device ? transport.pipe : undefined;
  }),
  requestWebSerialPort: vi.fn(async () => ({})),
  openWebSerialPipe: vi.fn(async (port: unknown, baud?: number) => {
    transport.baud.push(baud);
    return port ? transport.pipe : undefined;
  }),
}));

vi.mock('@integrations/radio-io/radios/radiofoundry/debugCapture.ts', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@integrations/radio-io/radios/radiofoundry/debugCapture.ts')
    >();
  return {
    ...actual,
    captureRadioFoundryDebugPipe: (
      pipe: import('@integrations/radio-io/types.ts').BytePipe,
      board: typeof MD9600_RADIOFOUNDRY_CABLE_BOARD,
      opts?: Parameters<typeof actual.captureRadioFoundryDebugPipe>[2],
    ) =>
      actual.captureRadioFoundryDebugPipe(pipe, board, {
        ...opts,
        protocolOptions: { pause: async () => {} },
      }),
  };
});

beforeEach(() => {
  transport.native = false;
  transport.baud = [];
});

describe('captureRadioFoundry', () => {
  it('reads over Web Serial and packs a live-read archive', async () => {
    transport.pipe = fakePipe();
    const archive = await captureRadioFoundry('MD-9600-RadioFoundry')();
    expect(archive.source).toBe('live-read');
    expect(archive.manifest.capturedVia).toBe('web-serial');
    expect(archive.manifest.radioModelId).toBe('MD-9600-RadioFoundry');
    expect(archive.manifest.regions.map((r) => r.id)).toEqual([
      RADIOFOUNDRY_REGION.eeprom,
      RADIOFOUNDRY_REGION.flash,
    ]);
    expect(transport.baud).toEqual([MD9600_RADIOFOUNDRY_CABLE_BOARD.baudRate]);
  });

  it('omits iddb-area2 unless the area-2 option is ticked', async () => {
    transport.pipe = fakePipe();
    const skipped = await captureRadioFoundry('MD-9600-RadioFoundry')({
      options: { [RADIOFOUNDRY_DEBUG_AREA2_OPTION]: false },
    });
    expect(skipped.manifest.regions.map((r) => r.id)).not.toContain(RADIOFOUNDRY_REGION.area2);
    const area2End = DMR_ID_DATABASE_AREA2_ADDRESS + BLOCK_SIZE * 2;
    const withArea2 = new FakeRadioFoundryRadio({
      imageEnd: area2End,
      physicalBase: MD9600_RADIOFOUNDRY_CABLE_BOARD.limits.PHYSICAL_CODEPLUG_BASE,
      versionText: versionTextFor(MD9600_RADIOFOUNDRY_CABLE_BOARD),
    });
    withArea2.setBlock(DMR_ID_DATABASE_AREA2_ADDRESS, new Uint8Array(BLOCK_SIZE).fill(0xaa));
    transport.pipe = withArea2;
    const included = await captureRadioFoundry('MD-9600-RadioFoundry')({
      options: { [RADIOFOUNDRY_DEBUG_AREA2_OPTION]: true },
    });
    expect(included.manifest.regions.map((r) => r.id)).toContain(RADIOFOUNDRY_REGION.area2);
  });

  it('rejects an unknown model without opening a port', async () => {
    await expect(captureRadioFoundry('NOT-A-RADIO')()).rejects.toThrow(/No RadioFoundry board/);
    expect(transport.baud).toEqual([]);
  });

  it('records Android USB serial when the native transport is used', async () => {
    transport.native = true;
    transport.pipe = fakePipe();
    const archive = await captureRadioFoundry('MD-9600-RadioFoundry')();
    expect(archive.manifest.capturedVia).toBe('android-usb-serial');
  });
});
