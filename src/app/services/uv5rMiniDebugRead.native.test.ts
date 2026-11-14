/**
 * The UV-5R Mini debug read in the Android app: the real grant/open seam and Capacitor pipe, over a fake USB-serial
 * plugin in front of the fake Mini.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  isUv5rMiniDebugFrameAllowed,
  Uv5rMiniDebugFrameRefusedError,
  Uv5rMiniReadOnlyPipe,
} from '@integrations/radio-io/radios/uv5r-mini/debugRead/index.ts';
import { FakeMiniRadio } from '@integrations/radio-io/radios/uv5r-mini/__fixtures__/fakeMiniRadio.ts';
import { UV5RMINI_RADIO_REPORT_LINK } from '@integrations/radio-io/radios/uv5r-mini/radioReportRead.ts';
import type { BytePipe } from '@integrations/radio-io/types.ts';

import {
  createFakeUsbSerialPlugin,
  FAKE_CH340_DEVICE,
  FAKE_ST_CDC_DEVICE,
} from './__fixtures__/fakeUsbSerialPlugin.ts';
import { isCapacitorFirmwarePort, openFirmwareLinkPipe } from './firmwarePort.ts';
import { grantUv5rMiniDebugPort, runUv5rMiniDebugFullRead } from './uv5rMiniDebugRead.ts';

const plugin = vi.hoisted(() => ({ current: null as unknown }));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
}));
vi.mock('@leeskies/capacitor-usb-serial', () => ({
  UsbSerial: new Proxy(
    {},
    { get: (_t, key) => (plugin.current as Record<string | symbol, unknown>)[key] },
  ),
}));

function radio(): FakeMiniRadio {
  const r = new FakeMiniRadio();
  for (let i = 0; i < r.flash.length; i++) r.flash[i] = (i * 5) & 0xff;
  r.plainFrom = 0xf000;
  return r;
}

/** The Mini, answering only when the port's last `setParameters` set this rate (silent at any other). */
function answeringOnlyAt(baudRate: number, inner: FakeMiniRadio): BytePipe {
  const atRate = () => fake.record.parameters.at(-1)?.baudRate === baudRate;
  return {
    write: async (data) => {
      if (atRate()) await inner.write(data);
    },
    readExact: async (n) => {
      if (!atRate()) throw new Error('silent');
      return inner.readExact(n);
    },
    close: async () => undefined,
  };
}

let fake: ReturnType<typeof createFakeUsbSerialPlugin>;
let mini: FakeMiniRadio;

beforeEach(() => {
  mini = radio();
  // The D890's port is attached too, so the grant has to pick the cable by its USB IDs.
  fake = createFakeUsbSerialPlugin({
    devices: [FAKE_ST_CDC_DEVICE, FAKE_CH340_DEVICE],
    radio: mini,
  });
  plugin.current = fake;
});

describe('UV-5R Mini debug read in the Android app', () => {
  it("grants the one device matching the Mini's cable, without a picker", async () => {
    const port = await grantUv5rMiniDebugPort();
    expect(isCapacitorFirmwarePort(port)).toBe(true);
    expect(isCapacitorFirmwarePort(port) && port.device.deviceId).toBe(FAKE_CH340_DEVICE.deviceId);
  });

  it('reads at 115200 8N1 with DTR and RTS raised, sends only allowlisted frames and closes', async () => {
    const port = await grantUv5rMiniDebugPort();
    const read = await runUv5rMiniDebugFullRead({ port, settleScale: 0 });

    expect(read.decoded).toEqual(mini.flash);
    expect(fake.record.opened).toEqual([FAKE_CH340_DEVICE.deviceId]);
    expect(fake.record.parameters).toEqual([
      { portId: 'port-1', baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none' },
    ]);
    expect(UV5RMINI_RADIO_REPORT_LINK.raiseDtrRts).toBe(true);
    expect(fake.record.dtr).toEqual([true]);
    expect(fake.record.rts).toEqual([true]);
    expect(fake.record.writes.length).toBeGreaterThan(1000);
    expect(fake.record.writes.every(isUv5rMiniDebugFrameAllowed)).toBe(true);
    expect(mini.wAddresses()).toEqual([]);
    expect(fake.record.closed).toBe(1);
  });

  it('closes and reopens the port at 38400, still 8N1 with DTR and RTS raised, when 115200 gets no answer', async () => {
    fake.setRadio(answeringOnlyAt(38400, mini));
    const port = await grantUv5rMiniDebugPort();
    // The ident waits its full timeout at 115200: run it on fake time.
    vi.useFakeTimers();
    let read: Awaited<ReturnType<typeof runUv5rMiniDebugFullRead>> | undefined;
    let failed: unknown;
    const running = runUv5rMiniDebugFullRead({ port, settleScale: 0 }).then(
      (r) => (read = r),
      (err: unknown) => (failed = err),
    );
    try {
      for (let i = 0; i < 1000 && read === undefined && failed === undefined; i++) {
        await vi.advanceTimersByTimeAsync(100);
      }
      await running;
    } finally {
      vi.useRealTimers();
    }

    expect(failed).toBeUndefined();
    expect(read?.decoded).toEqual(mini.flash);
    expect(fake.record.opened).toEqual([FAKE_CH340_DEVICE.deviceId, FAKE_CH340_DEVICE.deviceId]);
    expect(fake.record.parameters).toEqual([
      { portId: 'port-1', baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none' },
      { portId: 'port-2', baudRate: 38400, dataBits: 8, stopBits: 1, parity: 'none' },
    ]);
    expect(fake.record.dtr).toEqual([true, true]);
    expect(fake.record.rts).toEqual([true, true]);
    expect(fake.record.closed).toBe(2);
    expect(fake.record.writes.every(isUv5rMiniDebugFrameAllowed)).toBe(true);
    expect(mini.wAddresses()).toEqual([]);
  });

  it('refuses a write frame before it reaches the USB port', async () => {
    const port = await grantUv5rMiniDebugPort();
    const pipe = new Uv5rMiniReadOnlyPipe(
      await openFirmwareLinkPipe(port, 115200, UV5RMINI_RADIO_REPORT_LINK),
    );
    const w = new Uint8Array(4 + 64);
    w.set([0x57, 0x00, 0x00, 0x40]);
    await expect(pipe.write(w)).rejects.toBeInstanceOf(Uv5rMiniDebugFrameRefusedError);
    await pipe.close();
    expect(fake.record.writes).toEqual([]);
  });
});
