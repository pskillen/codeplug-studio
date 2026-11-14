/**
 * The AT-D890UV probe page's port: in the Android app the link-speed pass runs over the real grant/open seam and
 * Capacitor pipe (a fake USB-serial plugin in front of the fake D890); every other pass is refused before a port is
 * requested. In a browser the page's Web Serial open is unchanged.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RadioUnsupportedError } from '@integrations/radio-io/kit/errors.ts';
import { runAtD890LinkProbe } from '@integrations/radio-io/radios/at-d890uv/index.ts';
import * as transport from '@integrations/radio-io/transport/index.ts';

import {
  createFakeUsbSerialPlugin,
  FAKE_CH340_DEVICE,
  FAKE_ST_CDC_DEVICE,
} from './__fixtures__/fakeUsbSerialPlugin.ts';
import { FakeD890Radio } from './dangerZone/__fixtures__/fakeD890Radio.ts';
import { openAtD890ProbePipe } from './atD890ProbePort.ts';

const env = vi.hoisted(() => ({ native: true, plugin: null as unknown }));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => env.native, getPlatform: () => 'android' },
}));
vi.mock('@leeskies/capacitor-usb-serial', () => ({
  UsbSerial: new Proxy(
    {},
    { get: (_t, key) => (env.plugin as Record<string | symbol, unknown>)[key] },
  ),
}));
vi.mock('@integrations/radio-io/transport/index.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@integrations/radio-io/transport/index.ts')>();
  return {
    ...actual,
    requestWebSerialPort: vi.fn(async () => ({ close: async () => undefined })),
    openWebSerialPipe: vi.fn(async () => ({
      write: async () => undefined,
      readExact: async () => new Uint8Array(0),
      close: async () => undefined,
    })),
  };
});

let radio: FakeD890Radio;
let fake: ReturnType<typeof createFakeUsbSerialPlugin>;

beforeEach(() => {
  env.native = true;
  radio = new FakeD890Radio();
  // The Mini's cable is attached too, so the grant has to pick the D890 by its USB IDs.
  fake = createFakeUsbSerialPlugin({
    devices: [FAKE_CH340_DEVICE, FAKE_ST_CDC_DEVICE],
    radio: radio.open(),
  });
  env.plugin = fake;
  vi.mocked(transport.requestWebSerialPort).mockClear();
  vi.mocked(transport.openWebSerialPipe).mockClear();
});

describe('AT-D890UV probe port in the Android app', () => {
  it('runs the link-speed pass on the D890 at 921600 8N1 with DTR and RTS raised, writing nothing', async () => {
    const pipe = await openAtD890ProbePipe('link', 'Profile link speed (read-only)');
    const r = await runAtD890LinkProbe(pipe);
    await pipe.close();

    expect(fake.record.opened).toEqual([FAKE_ST_CDC_DEVICE.deviceId]);
    expect(fake.record.parameters).toEqual([
      { portId: 'port-1', baudRate: 921600, dataBits: 8, stopBits: 1, parity: 'none' },
    ]);
    expect(fake.record.dtr).toEqual([true]);
    expect(fake.record.rts).toEqual([true]);
    expect(radio.allWrites()).toEqual([]);
    expect(radio.frames.map((f) => f.kind)).not.toContain('W');
    expect(r.profile.bestBlockSize).toBeGreaterThan(0x10);
    expect(r.sweep.frameTiming).toBeDefined();
    expect(r.sweep.frameTiming!.maxFrameMs).toBeGreaterThanOrEqual(r.sweep.frameTiming!.p99FrameMs);
    expect(fake.record.closed).toBe(1);
    expect(transport.requestWebSerialPort).not.toHaveBeenCalled();
  });

  it.each(['inspect', 'paint', 'mark', 'measure', 'diagnose', 'configAlias'])(
    'refuses the %s pass before any port is requested',
    async (pass) => {
      await expect(openAtD890ProbePipe(pass, pass)).rejects.toBeInstanceOf(RadioUnsupportedError);
      expect(fake.record.opened).toEqual([]);
      expect(fake.record.writes).toEqual([]);
      expect(transport.requestWebSerialPort).not.toHaveBeenCalled();
    },
  );
});

describe('AT-D890UV probe port in a browser', () => {
  it('opens every pass from a fresh unfiltered picker at 921600, as before', async () => {
    env.native = false;
    for (const pass of ['paint', 'link']) await openAtD890ProbePipe(pass, pass);
    expect(vi.mocked(transport.requestWebSerialPort).mock.calls).toEqual([[false], [false]]);
    expect(vi.mocked(transport.openWebSerialPipe).mock.calls.map((c) => c.slice(1))).toEqual([
      [921600],
      [921600],
    ]);
    expect(fake.record.opened).toEqual([]);
  });
});
